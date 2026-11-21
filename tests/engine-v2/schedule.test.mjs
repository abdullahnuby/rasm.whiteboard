import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRaster, buildDrawingPlan, buildRevealSchedule } from "../../.build/index.js";

function raster(width, height) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const q = p * 4; pixels[q] = pixels[q + 1] = pixels[q + 2] = 255; pixels[q + 3] = 255;
  }
  return pixels;
}
function rect(pixels, width, x0, y0, x1, y1, colour) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = (y * width + x) * 4;
    pixels[p] = colour[0]; pixels[p + 1] = colour[1]; pixels[p + 2] = colour[2];
  }
}

test("reveal schedule completes the first RTL element before starting the next", () => {
  const width = 64, height = 24, pixels = raster(width, height);
  rect(pixels, width, 3, 6, 12, 18, [20, 70, 160]);
  rect(pixels, width, 46, 6, 57, 18, [190, 40, 20]);
  const analysis = analyzeRaster(pixels, width, height);
  const paths = [
    { id: "left", points: [[4, 12], [7, 12], [11, 12]], source: "centerline" },
    { id: "right", points: [[47, 12], [51, 12], [56, 12]], source: "centerline" }
  ];
  const drawing = buildDrawingPlan(analysis, paths, [], { direction: "rtl" });
  const schedule = buildRevealSchedule({
    width, height, rasterLabels: drawing.rasterLabels, lines: drawing.lines,
    totalDistance: drawing.totalDistance,
    shapeGroups: drawing.elements.map(element => ({ id: element.id, rasterComponentLabels: element.componentIds }))
  });
  const pixelTimes = schedule.timings;
  const firstLabel = drawing.elements[0].componentIds[0], secondLabel = drawing.elements[1].componentIds[0];
  const first = [], second = [];
  for (let pixel = 0; pixel < drawing.rasterLabels.length; pixel++) {
    if (drawing.rasterLabels[pixel] === firstLabel) first.push(pixelTimes[pixel]);
    if (drawing.rasterLabels[pixel] === secondLabel) second.push(pixelTimes[pixel]);
  }
  assert.ok(first.length && second.length);
  assert.ok(Math.max(...first) <= Math.min(...second), "Element 2 pixels must not precede completion of element 1");
  assert.equal(schedule.ends[256], width * height);
  assert.equal(schedule.diagnostics.unscheduledPixels, 0);
  assert.equal(schedule.diagnostics.unseededComponents.length, 0);
});

test("scheduler rejects an element whose component has no pen route", () => {
  const width = 24, height = 16, pixels = raster(width, height);
  rect(pixels, width, 3, 3, 9, 10, [10, 20, 150]);
  const analysis = analyzeRaster(pixels, width, height);
  const drawing = buildDrawingPlan(analysis, [], [], { direction: "rtl" });
  assert.throws(() => buildRevealSchedule({
    width, height, rasterLabels: drawing.rasterLabels,
    lines: [], totalDistance: 0,
    shapeGroups: drawing.elements.map(element => ({ id: element.id, rasterComponentLabels: element.componentIds }))
  }), /physical hand route|hand path|route/i);
});
