'use strict';
importScripts('motion.js');
self.onmessage = event => {
  const { id, width, height, length, lines, rasterLabels, shapeGroups, shapeSequence } = event.data || {};
  try {
    const scene = { src: { width, height }, length, lines, rasterLabels, shapeGroups, shapeSequence };
    const plan = self.buildColorSchedule(scene);
    self.postMessage({ id, plan }, [plan.order.buffer, plan.ends.buffer]);
  } catch (error) {
    self.postMessage({ id, error: String(error && error.message || error) });
  }
};
