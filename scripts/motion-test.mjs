import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(await readFile('dist/motion.js', 'utf8'), context);
const core = vm.runInContext('({edgeSkinRegion,overlayEnabled,sceneSeconds,strokeProgress})', context);

const pixels = new Uint8ClampedArray(100 * 100 * 4).fill(255);
assert.equal(core.edgeSkinRegion(pixels, 100, 100), false);
for (let y = 30; y < 100; y++) for (let x = 42; x < 68; x++) pixels.set([163, 109, 82, 255], (y * 100 + x) * 4);
assert.equal(core.edgeSkinRegion(pixels, 100, 100), true);

for (const tone of [0, 1, 3, 4]) {
  assert.equal(core.overlayEnabled({ tone, handHint: true, sourceHand: 'auto' }), true);
  assert.equal(core.overlayEnabled({ tone, handHint: true, sourceHand: 'detect' }), false);
  assert.equal(core.overlayEnabled({ tone, handHint: false, sourceHand: 'present' }), false);
  assert.equal(core.overlayEnabled({ tone, handHint: true, sourceHand: 'clean' }), true);
}
assert.equal(core.overlayEnabled({ tone: 2, sourceHand: 'clean' }), false);

const scene = {
  duration: 10, speed: 0.5, length: 4,
  lines: [
    { id: 'one', start: 0, points: [[10, 10], [20, 10]], elementId: 1 },
    { id: 'two', start: 2, points: [[30, 10], [40, 10]], elementId: 2 }
  ]
};
assert.equal(core.sceneSeconds(scene), 20);
const start = core.strokeProgress(scene, 0);
assert.deepEqual(Array.from(start.tip), [10, 10]);
assert.equal(start.target, 0);
assert.equal(start.drawing, true);
const lift = core.strokeProgress(scene, 0.5);
assert.equal(lift.drawing, false, 'Pen lift between elements must not be treated as drawing');
assert.equal(lift.target, 2);
assert.ok(lift.tip[0] > 20 && lift.tip[0] < 30);
const second = core.strokeProgress(scene, 0.75);
assert.equal(second.drawing, true);
assert.equal(second.target, 2);
assert.ok(second.tip[0] > 30 && second.tip[0] < 40);
const end = core.strokeProgress(scene, 1);
assert.equal(end.target, 4);
assert.deepEqual(Array.from(end.tip), [40, 10]);
for (const fraction of [-1, -1e-6, NaN, 0, 1, 2]) {
  const result = core.strokeProgress(scene, fraction);
  assert.ok(Number.isFinite(result.target));
  assert.ok(result.target >= 0 && result.target <= scene.length);
}
console.log('RASM motion and physical hand-progress tests passed.');
