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
console.log('RASM motion worker tests passed.');
