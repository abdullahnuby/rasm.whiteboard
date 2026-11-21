import test from "node:test";
import assert from "node:assert/strict";
import { createRevealWorkerRequest, workerTransferables } from "../../.build/index.js";

test("worker contract copies raster labels and transfers only an owned buffer", () => {
  const labels = new Uint32Array(32 * 16); labels.fill(1);
  const request = createRevealWorkerRequest(4, {
    width: 32, height: 16, rasterLabels: labels, totalDistance: 12,
    lines: [{ id: "line", elementId: 1, shapeId: 1, componentId: 1, points: [[2, 8], [15, 8]], source: "centerline" }],
    shapeGroups: [{ id: 1, rasterComponentLabels: [1] }]
  });
  assert.notEqual(request.rasterLabels, labels);
  assert.equal(labels[0], 1, "Building the worker message must not detach or mutate the live plan");
  assert.equal(workerTransferables(request).length, 1);
  assert.equal(request.lines[0].elementId, 1);
});
