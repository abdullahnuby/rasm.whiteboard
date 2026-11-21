import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = vm.createContext({});
context.self = context;
let response = null;
context.postMessage = message => { response = message; };
context.importScripts = name => {
  assert.equal(name, 'motion.js');
  vm.runInContext(motionSource, context);
};
const motionSource = await readFile('dist/motion.js', 'utf8');
const workerSource = await readFile('dist/motion-worker.js', 'utf8');
vm.runInContext(workerSource, context);
const lines = [
  { start: 0, points: [[0, 0], [1, 0], [2, 0]] },
  { start: 3, points: [[3, 1], [3, 2]] }
];
context.onmessage({ data: { id: 7, width: 4, height: 4, length: 5, lines } });
assert.equal(response.id, 7);
assert.equal(response.error, undefined);
assert.equal(response.plan.ends[256], 16);
assert.equal(response.plan.order.length, 16);
assert.equal(new Set(Array.from(response.plan.order)).size, 16);
for (let index = 0; index < 16; index++) assert.ok(response.plan.order.includes(index));
const width = 40, height = 16, labels = new Uint16Array(width * height);
for (let y = 3; y <= 12; y++) for (let x = 2; x <= 16; x++) labels[y * width + x] = 1;
for (let offset = 1; offset <= 3; offset++) labels[(12 + offset) * width + (16 + offset)] = 1; // diagonal-only tail
for (let y = 3; y <= 9; y++) for (let x = 24; x <= 32; x++) labels[y * width + x] = 2;
const elementLines = [
  { start: 0, shapeId: 1, points: [[3, 6], [8, 6], [16, 12]] },
  { start: 3, shapeId: 1, points: [[14, 10], [16, 10]] },
  { start: 5, shapeId: 2, points: [[25, 6], [31, 6]] }
];
response = null;
context.onmessage({ data: {
  id: 8, width, height, length: 7, lines: elementLines,
  rasterLabels: labels,
  shapeSequence: 'smart',
  shapeGroups: [
    { id: 1, rasterComponentLabels: [1] },
    { id: 2, rasterComponentLabels: [2] }
  ]
} });
assert.equal(response.id, 8);
assert.equal(response.error, undefined);
const pixelTimes = new Uint16Array(width * height);
for (let t = 0; t < 256; t++) {
  for (let i = response.plan.ends[t]; i < response.plan.ends[t + 1]; i++) pixelTimes[response.plan.order[i]] = t;
}
const firstPixels = [], secondPixels = [];
for (let p = 0; p < labels.length; p++) {
  if (labels[p] === 1) firstPixels.push(pixelTimes[p]);
  if (labels[p] === 2) secondPixels.push(pixelTimes[p]);
}
assert.ok(Math.max(...firstPixels) < Math.min(...secondPixels),
  'The worker must finish revealing element 1 before beginning element 2');
context.elementLines = elementLines;
assert.ok(pixelTimes[15 * width + 19] < Math.max(...firstPixels),
  'Diagonally connected pixels must reveal during their owning element, not as late leftovers');
const physical = vm.runInContext('strokeTravelPlan(elementLines)', context);
const firstSegment = physical.segments[1], secondSegment = physical.segments[2];
assert.equal(Math.max(...firstPixels), Math.floor(255 * firstSegment.end / physical.end),
  'Element 1 final pixels must reveal when its final hand path completes');
assert.equal(Math.min(...secondPixels), Math.floor(255 * secondSegment.draw / physical.end),
  'Element 2 must start revealing only when the hand arrives at its first path');

console.log('RASM motion worker tests passed.');
