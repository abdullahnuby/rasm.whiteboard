'use strict';
try { importScripts('vendor/paper-core.js'); } catch { /* Paper.js simplification is optional in workers. */ }
importScripts('engine-v2.js','engine.js');
self.onmessage = event => {
  const { id, width, height, pixels } = event.data || {};
  try {
    const data = new Uint8ClampedArray(pixels);
    const result = self.RasmImageEngine.extractPaths(data, width, height);
    result.engineAnalysisV2 = self.RasmWhiteboardCore.analyzeRaster(data, width, height);
    self.postMessage({ id, result }, [result.engineAnalysisV2.rasterLabels.buffer]);
  } catch (error) {
    self.postMessage({ id, error: String(error && error.message || error) });
  }
};
