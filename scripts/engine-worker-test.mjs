import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = vm.createContext({
  Uint8Array, Uint8ClampedArray, Uint32Array, Int32Array, Int16Array,
  Uint16Array, Float32Array, Float64Array, Map, Set, Math, Number, Object,
  Array, TypeError, Error, Promise, performance: { now: () => Date.now() }
});
context.self = context;
const responses = [];
context.postMessage = message => responses.push(message);
const sources = {
  'engine-v2.js': await readFile('dist/engine-v2.js', 'utf8'),
  'engine.js': await readFile('dist/engine.js', 'utf8')
};
context.importScripts = (...names) => {
  for (const name of names) {
    if (name === 'vendor/paper-core.js') throw new Error('Paper.js is optional in this test.');
    if (!sources[name]) throw new Error('Unexpected worker import: ' + name);
    vm.runInContext(sources[name], context);
  }
};
const workerSource = await readFile('dist/engine-worker.js', 'utf8');
vm.runInContext(workerSource, context);

const width = 48, height = 32;
const pixels = new Uint8ClampedArray(width * height * 4);
for (let p = 0; p < width * height; p++) {
  const q = p * 4;
  pixels[q] = pixels[q + 1] = pixels[q + 2] = 255;
  pixels[q + 3] = 255;
}
for (let y = 7; y <= 24; y++) for (let x = 6; x <= 40; x++) {
  const q = (y * width + x) * 4;
  pixels[q] = pixels[q + 1] = pixels[q + 2] = 0;
}
context.onmessage({ data: { id: 1, action: 'analyze', width, height, pixels: pixels.buffer } });
const analysed = responses.shift();
assert.equal(analysed.id, 1);
assert.equal(analysed.error, undefined);
assert.ok(analysed.result.engineAnalysisV2);
assert.equal(analysed.result.engineAnalysisV2.rasterLabels.length, width * height);
assert.ok(analysed.result.engineAnalysisV2.components.length > 0);

const componentId = analysed.result.engineAnalysisV2.components[0].id;
const path = {
  id: 'worker-centerline',
  points: [[8, 15], [15, 15], [25, 15], [38, 15]],
  source: 'centerline',
  componentId
};
context.onmessage({ data: {
  id: 2, action: 'plan', width, height,
  analysis: analysed.result.engineAnalysisV2,
  centerBaseLines: [path],
  baseLines: [path],
  options: { direction: 'rtl', motionStyle: 'smart', zones: [] }
} });
const planned = responses.shift();
assert.equal(planned.id, 2);
assert.equal(planned.error, undefined);
assert.ok(planned.result.plan);
assert.ok(planned.result.plan.lines.length > 0);
assert.equal(planned.result.plan.rasterLabels.length, width * height);
for (const line of planned.result.plan.lines) {
  assert.ok(line.cumulative instanceof Float32Array, 'Worker should precompute stroke distance samples');
  assert.equal(line.cumulative.length, line.points.length);
  assert.ok(line.cumulative[line.cumulative.length - 1] >= 0);
}
console.log('RASM image Worker analysis + planning tests passed.');
