import assert from 'node:assert/strict';
import { analyzeRaster, buildDrawingPlan, buildRevealSchedule } from '../.build/index.js';

function raster(width, height) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const q = p * 4;
    pixels[q] = pixels[q + 1] = pixels[q + 2] = 255;
    pixels[q + 3] = 255;
  }
  return pixels;
}
function rect(pixels, width, x0, y0, x1, y1, color) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = (y * width + x) * 4;
    pixels[p] = color[0]; pixels[p + 1] = color[1]; pixels[p + 2] = color[2];
  }
}

const width = 64, height = 24, pixels = raster(width, height);
rect(pixels, width, 3, 6, 12, 18, [20, 70, 160]);
rect(pixels, width, 46, 6, 57, 18, [190, 40, 20]);
const analysis = analyzeRaster(pixels, width, height);
const centerPaths = [
  { id: 'left', points: [[4, 12], [7, 12], [11, 12]], source: 'centerline' },
  { id: 'right', points: [[47, 12], [51, 12], [56, 12]], source: 'centerline' }
];
const plan = buildDrawingPlan(analysis, centerPaths, [], { direction: 'rtl' });
const schedule = buildRevealSchedule({
  width, height, rasterLabels: plan.rasterLabels, lines: plan.lines,
  totalDistance: plan.totalDistance,
  shapeGroups: plan.elements.map(element => ({ id: element.id, rasterComponentLabels: element.componentIds }))
});
assert.equal(schedule.order.length, width * height);
assert.equal(schedule.ends[256], width * height);
assert.equal(schedule.diagnostics.unscheduledPixels, 0);
const times = schedule.timings;
const firstLabel = plan.elements[0].componentIds[0], secondLabel = plan.elements[1].componentIds[0];
const first = [], second = [];
for (let pixel = 0; pixel < plan.rasterLabels.length; pixel++) {
  if (plan.rasterLabels[pixel] === firstLabel) first.push(times[pixel]);
  if (plan.rasterLabels[pixel] === secondLabel) second.push(times[pixel]);
}
assert.ok(first.length && second.length);
assert.ok(Math.max(...first) <= Math.min(...second),
  'The first element must finish before the second element starts');
assert.equal(schedule.diagnostics.unseededComponents.length, 0);
console.log('RASM element-aware raster schedule tests passed.');
