'use strict';
importScripts('engine-v2.js','motion.js');
self.onmessage = event => {
  const { id, width, height, totalDistance, lines, rasterLabels, shapeGroups } = event.data || {};
  try {
    const scene = {
      src: { width, height }, totalDistance, lines, rasterLabels, shapeGroups,
      mode: 'original'
    };
    const result = self.RasmWhiteboardCore.buildLegacyRevealSchedule(scene);
    const plan = {
      order: result.order, ends: result.ends,
      totalPixels: result.totalPixels, totalDistance: result.totalDistance,
      elementWindows: result.elementWindows, diagnostics: result.diagnostics
    };
    self.postMessage({ id, plan }, [plan.order.buffer, plan.ends.buffer]);
  } catch (error) {
    self.postMessage({ id, error: String(error && error.message || error) });
  }
};
