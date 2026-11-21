'use strict';
try { importScripts('vendor/paper-core.js'); } catch { /* Paper.js simplification is optional in workers. */ }
importScripts('engine-v2.js','engine.js');

self.onmessage = event => {
  const message = event.data || {};
  const { id, action, width, height } = message;
  try {
    if (action === 'plan') {
      const analysis = message.analysis;
      if (!analysis || !(analysis.rasterLabels instanceof Uint32Array)) {
        throw new Error('Drawing-plan request has no valid raster ownership map.');
      }
      const scene = {
        src: { width, height },
        baseLines: message.baseLines || [],
        centerBaseLines: message.centerBaseLines || [],
        elementDirection: message.options?.direction || 'rtl',
        motionStyle: message.options?.motionStyle || 'smart',
        zones: message.options?.zones || []
      };
      const applied = self.RasmWhiteboardCore.applyToLegacyScene(scene, analysis);
      const plan = applied.plan;
      self.postMessage({ id, result: { plan } }, [plan.rasterLabels.buffer]);
      return;
    }

    if (action !== 'analyze') throw new Error('Unknown image-worker action: ' + String(action || 'missing'));
    const data = new Uint8ClampedArray(message.pixels);
    const result = self.RasmImageEngine.extractPaths(data, width, height);
    result.engineAnalysisV2 = self.RasmWhiteboardCore.analyzeRaster(data, width, height);
    self.postMessage({ id, result }, [result.engineAnalysisV2.rasterLabels.buffer]);
  } catch (error) {
    self.postMessage({ id, error: String(error && error.message || error) });
  }
};
