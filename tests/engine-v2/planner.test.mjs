import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRaster, buildDrawingPlan, traceComponentOutline } from "../../.build/index.js";

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

function makeTwoObjects() {
  const width = 72, height = 28, pixels = raster(width, height);
  rect(pixels, width, 5, 7, 18, 20, [20, 90, 150]);
  rect(pixels, width, 49, 7, 62, 20, [190, 45, 15]);
  const analysis = analyzeRaster(pixels, width, height);
  const paths = [
    { id: "left-centre", points: [[7, 13], [11, 13], [16, 13]], source: "centerline" },
    { id: "right-centre", points: [[51, 13], [55, 13], [60, 13]], source: "centerline" }
  ];
  return { width, height, analysis, paths };
}

test("RTL and LTR orders operate on complete elements, not a global line list", () => {
  const { width, height, analysis, paths } = makeTwoObjects();
  const rtl = buildDrawingPlan(analysis, paths, [], { direction: "rtl" });
  const ltr = buildDrawingPlan(analysis, paths, [], { direction: "ltr" });
  assert.equal(rtl.elements.length, 2);
  assert.ok(rtl.elements[0].bounds.cx > rtl.elements[1].bounds.cx);
  assert.ok(ltr.elements[0].bounds.cx < ltr.elements[1].bounds.cx);
  assert.ok(rtl.lines.every(line => Number.isInteger(line.elementId) && Number.isInteger(line.componentId)));
  assert.equal(rtl.length, rtl.lines.reduce((sum, line) => sum + line.points.length, 0));
  assert.ok(width > 0 && height > 0);
});

test("every raster component gets a real route; missing centerline is traced from its own pixels", () => {
  const { analysis, paths } = makeTwoObjects();
  const onlyRightPath = [paths[1]];
  const plan = buildDrawingPlan(analysis, onlyRightPath, [], { direction: "rtl" });
  assert.equal(plan.elements.length, 2);
  assert.equal(plan.diagnostics.tracedComponents, 1);
  assert.ok(plan.elements.every(element => element.strokes.length > 0));
  const traced = plan.lines.find(line => line.source === "raster-outline");
  assert.ok(traced, "Missing vector route must be replaced by a trace of the component outline");
  assert.ok(traced.points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
});

test("outline tracer returns a path inside the owning component", () => {
  const width = 20, height = 18, pixels = raster(width, height);
  rect(pixels, width, 4, 4, 13, 12, [0, 0, 0]);
  const analysis = analyzeRaster(pixels, width, height);
  const component = analysis.components[0];
  const path = traceComponentOutline(analysis.rasterLabels, width, height, component.id, component.bounds);
  assert.ok(path && path.points.length >= 3);
  for (const [x, y] of path.points) {
    const px = Math.max(0, Math.min(width - 1, Math.round(x)));
    const py = Math.max(0, Math.min(height - 1, Math.round(y)));
    assert.equal(analysis.rasterLabels[py * width + px], component.id);
  }
});


test("partially covered connected elements receive contour supplementation", () => {
  const width = 64, height = 40, pixels = raster(width, height);
  rect(pixels, width, 8, 5, 10, 29, [20, 80, 150]);
  rect(pixels, width, 8, 27, 39, 29, [20, 80, 150]);
  const analysis = analyzeRaster(pixels, width, height);
  assert.equal(analysis.components.length, 1);
  const centerline = [{ id: "vertical-only", points: [[9, 6], [9, 28]], source: "centerline" }];
  const contour = [{
    id: "whole-l-outline",
    points: [[8, 5], [10, 5], [10, 27], [39, 27], [39, 29], [8, 29], [8, 5]],
    source: "contour"
  }];
  const plan = buildDrawingPlan(analysis, centerline, contour, { direction: "ltr" });
  const contourStrokes = plan.lines.filter(line => line.source === "contour");
  assert.ok(contourStrokes.length > 0, "Uncovered branches must not be silently dropped");
  assert.ok(plan.elements[0].diagnostics.warnings.some(warning => warning.includes("coverage")));
});
