import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRaster, assignPathsToElements } from "../../.build/index.js";

function raster(width, height) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const q = p * 4; pixels[q] = pixels[q + 1] = pixels[q + 2] = 255; pixels[q + 3] = 255;
  }
  return pixels;
}
function rect(pixels, width, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = (y * width + x) * 4; pixels[p] = 0; pixels[p + 1] = 0; pixels[p + 2] = 0;
  }
}

test("a vector path crossing two components is split by pixel ownership", () => {
  const width = 50, height = 20, pixels = raster(width, height);
  rect(pixels, width, 3, 5, 12, 14);
  rect(pixels, width, 36, 5, 45, 14);
  const analysis = analyzeRaster(pixels, width, height);
  const elements = analysis.elements.map(element => ({ ...element, strokes: [], diagnostics: {
    source: "segmented", tracedComponentIds: [], warnings: []
  }}));
  const result = assignPathsToElements([
    { points: [[4, 9], [9, 9], [15, 9], [22, 9], [29, 9], [35, 9], [43, 9] }
  ], analysis.rasterLabels, width, height, elements, analysis.components, "centerline");
  assert.equal(result.byElement.size, 2);
  assert.equal(result.assignedPaths, 2);
  assert.equal(result.splitPaths, 1);
  assert.deepEqual(new Set([...result.byElement.values()].flat().map(path => path.componentId)),
    new Set(analysis.components.map(component => component.id)));
});
