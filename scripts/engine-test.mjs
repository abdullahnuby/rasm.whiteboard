import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile('dist/engine.js', 'utf8');
const context = vm.createContext({ Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int16Array, Int32Array, Float32Array, Map, Math, Number, TypeError });
vm.runInContext(source, context);
const engine = context.RasmImageEngine;
assert.ok(engine, 'Image engine should be exported');

function image(width, height, fill = 255) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = fill; pixels[i * 4 + 1] = fill; pixels[i * 4 + 2] = fill; pixels[i * 4 + 3] = 255;
  }
  return pixels;
}
function paintRect(pixels, width, x1, y1, x2, y2, color = 0) {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
    const p = (y * width + x) * 4;
    pixels[p] = pixels[p + 1] = pixels[p + 2] = color;
  }
}
function assertPathsValid(result, width, height) {
  assert.ok(result.lines.length > 0, 'Expected at least one path');
  let lastStart = 0;
  for (const line of result.lines) {
    assert.equal(line.start, lastStart);
    assert.ok(line.points.length >= 2);
    for (const point of line.points) {
      assert.ok(Number.isFinite(point[0]) && Number.isFinite(point[1]));
      assert.ok(point[0] >= 0 && point[0] < width && point[1] >= 0 && point[1] < height);
    }
    for (let i = 1; i < line.points.length; i++) {
      const dx = line.points[i][0] - line.points[i - 1][0];
      const dy = line.points[i][1] - line.points[i - 1][1];
      assert.ok(Math.hypot(dx, dy) <= 2, 'Path should not jump across image rows or borders');
    }
    lastStart += line.points.length;
  }
  assert.equal(result.length, lastStart);
}

// Blank images should not generate noise paths.
const blank = engine.extractPaths(image(64, 48), 64, 48);
assert.equal(blank.lines.length, 0);

// A horizontal marker stroke should become one or more continuous paths.
const horizontal = image(64, 48);
paintRect(horizontal, 64, 6, 22, 56, 25);
const horizontalResult = engine.extractPaths(horizontal, 64, 48);
assertPathsValid(horizontalResult, 64, 48);
assert.ok(horizontalResult.metrics.edgePixels > 0);
assert.ok(Array.isArray(horizontalResult.centerLines) && horizontalResult.centerLines.length > 0,
  'A thick marker stroke should produce a centerline writing path');
assert.ok(horizontalResult.centerLength < horizontalResult.length,
  'Centerline motion should use fewer points than tracing both stroke borders');

// Exercise image-edge handling: disconnected pixels at opposite ends must
// never be joined by accidental linear-index wraparound.
const border = image(48, 32);
paintRect(border, 48, 0, 8, 4, 23);
paintRect(border, 48, 43, 8, 47, 23);
const borderResult = engine.extractPaths(border, 48, 32);
assertPathsValid(borderResult, 48, 32);
for (const line of borderResult.lines) {
  const xs = line.points.map(p => p[0]);
  const spread = Math.max(...xs) - Math.min(...xs);
  assert.ok(spread < 20, 'Disconnected left/right border strokes must remain separate');
}

// Simplification must preserve endpoints; resampling must retain a drawable path.
const raw = [[0, 0], [1, 0.1], [2, 0], [3, 0.1], [4, 0]];
const simple = engine.simplifyPolyline(raw, 0.5);
assert.deepEqual(Array.from(simple[0]), [0, 0]);
assert.deepEqual(Array.from(simple.at(-1)), [4, 0]);
assert.ok(engine.resamplePolyline(simple, 1).length >= 2);

console.log('RASM image engine tests passed.');
