import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRaster, groupComponents, labelConnectedComponents } from "../../.build/index.js";

function raster(width, height, background = 255) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const offset = p * 4;
    pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = background;
    pixels[offset + 3] = 255;
  }
  return pixels;
}
function paint(pixels, width, x0, y0, x1, y1, colour) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = (y * width + x) * 4;
    pixels[p] = colour[0]; pixels[p + 1] = colour[1]; pixels[p + 2] = colour[2];
  }
}

test("8-connected labels keep diagonal pixels in one component", () => {
  const mask = new Uint8Array(8 * 8);
  mask[2 * 8 + 2] = 1; mask[3 * 8 + 3] = 1; mask[4 * 8 + 4] = 1;
  const result = labelConnectedComponents(mask, 8, 8);
  assert.equal(result.components.length, 1);
  assert.equal(result.components[0].area, 3);
  assert.equal(result.labels[2 * 8 + 2], result.labels[4 * 8 + 4]);
});

test("segmentation preserves separate objects and attaches a detached small mark", () => {
  const width = 64, height = 32, pixels = raster(width, height);
  paint(pixels, width, 5, 9, 16, 22, [15, 80, 150]);
  paint(pixels, width, 10, 5, 11, 6, [15, 80, 150]);
  paint(pixels, width, 43, 9, 55, 22, [200, 35, 20]);
  const result = analyzeRaster(pixels, width, height);
  assert.equal(result.components.length, 3);
  assert.equal(result.elements.length, 2, "The small detached mark should join its base, not the neighbouring object");
  assert.equal(result.elements[0].componentIds.length, 2);
  assert.equal(result.elements[1].componentIds.length, 1);
  assert.ok(result.rasterLabels[0] === 0, "Background must remain unowned by a drawable element");
});

test("segmentation retains one-pixel marks instead of dropping them as noise", () => {
  const mask = new Uint8Array(12 * 12);
  mask[5 * 12 + 5] = 1;
  const result = labelConnectedComponents(mask, 12, 12, 1);
  assert.equal(result.components.length, 1);
  assert.equal(result.components[0].area, 1);
});


test("spatial grouping handles thousands of unrelated detached components", () => {
  const components = [];
  const columns = 100;
  for (let index = 0; index < 5000; index++) {
    // Keep the entire fixture inside one spatial cell. All marks have equal,
    // tiny dimensions and therefore cannot enclose or attach to one another.
    const x = (index % columns) * 0.45;
    const y = Math.floor(index / columns) * 0.45;
    components.push({
      id: index + 1, area: 1,
      bounds: { x, y, width: 0.1, height: 0.1, cx: x + 0.05, cy: y + 0.05 }
    });
  }
  const groups = groupComponents(components);
  assert.equal(groups.length, components.length);
});
