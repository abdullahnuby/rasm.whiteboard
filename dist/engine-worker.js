'use strict';
importScripts('engine.js');
self.onmessage = event => {
  const { id, width, height, pixels } = event.data || {};
  try {
    const data = new Uint8ClampedArray(pixels);
    const result = self.RasmImageEngine.extractPaths(data, width, height);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: String(error && error.message || error) });
  }
};
