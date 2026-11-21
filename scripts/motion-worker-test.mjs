import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = vm.createContext({});
context.self = context;
let response = null;
context.postMessage = message => { response = message; };
context.importScripts = (...names) => {
  for (const name of names) {
    if (name === 'engine-v2.js') {
      vm.runInContext(engineSource, context);
    } else if (name === 'motion.js') {
      vm.runInContext(motionSource, context);
    } else {
      throw new Error('Unexpected worker import: ' + name);
    }
  }
};
const engineSource = await readFile('dist/engine-v2.js', 'utf8');
const motionSource = await readFile('dist/motion.js', 'utf8');
const workerSource = await readFile('dist/motion-worker.js', 'utf8');
vm.runInContext(workerSource, context);

const width = 40, height = 16, labels = new Uint32Array(width * height);
for (let y = 3; y <= 11; y++) for (let x = 2; x <= 10; x++) labels[y * width + x] = 1;
for (let y = 3; y <= 11; y++) for (let x = 27; x <= 35; x++) labels[y * width + x] = 2;
const lines = [
  { id: 'right-element', start: 0, elementId: 1, shapeId: 1, componentId: 1, points: [[3, 7], [6, 7], [9, 7]] },
  { id: 'left-element', start: 3, elementId: 2, shapeId: 2, componentId: 2, points: [[28, 7], [31, 7], [34, 7]] }
];
context.onmessage({ data: {
  id: 7, width, height, totalDistance: 37, lines, rasterLabels: labels,
  shapeGroups: [
    { id: 1, rasterComponentLabels: [1] },
    { id: 2, rasterComponentLabels: [2] }
  ]
} });
assert.equal(response.id, 7);
assert.equal(response.error, undefined);
assert.equal(response.plan.order.length, width * height);
assert.equal(response.plan.ends[256], width * height);
const times = new Uint8Array(width * height);
for (let t = 0; t < 256; t++) {
  for (let i = response.plan.ends[t]; i < response.plan.ends[t + 1]; i++) times[response.plan.order[i]] = t;
}
const first = [], second = [];
for (let p = 0; p < labels.length; p++) {
  if (labels[p] === 1) first.push(times[p]);
  if (labels[p] === 2) second.push(times[p]);
}
assert.ok(Math.max(...first) <= Math.min(...second), 'Worker must complete the first element before the second.');
assert.ok(response.plan.elementWindows.length === 2);
console.log('RASM Engine v2 motion worker integration tests passed.');
