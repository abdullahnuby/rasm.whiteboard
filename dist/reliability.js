'use strict';
(function (root) {
  function fitDimensions(width, height, maxWidth = 960, maxHeight = 720) {
    if (![width, height, maxWidth, maxHeight].every(Number.isFinite) ||
        width <= 0 || height <= 0 || maxWidth < 3 || maxHeight < 3) return null;
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    const fittedWidth = Math.max(3, Math.round(width * scale));
    const fittedHeight = Math.max(3, Math.round(height * scale));
    return { width: fittedWidth, height: fittedHeight, pixels: fittedWidth * fittedHeight };
  }
  function withinPixelBudget(currentPixels, incomingPixels, limit) {
    return Number.isSafeInteger(currentPixels) && Number.isSafeInteger(incomingPixels) &&
      Number.isSafeInteger(limit) && currentPixels >= 0 && incomingPixels >= 0 &&
      limit >= 0 && incomingPixels <= limit && currentPixels <= limit - incomingPixels;
  }
  function createSerialQueue() {
    let tail = Promise.resolve();
    return function enqueue(task) {
      if (typeof task !== 'function') return Promise.reject(new TypeError('Queue task must be a function'));
      const result = tail.then(task, task);
      tail = result.then(() => undefined, () => undefined);
      return result;
    };
  }
  root.RasmReliability = Object.freeze({ fitDimensions, withinPixelBudget, createSerialQueue });
})(typeof window !== 'undefined' ? window : globalThis);
