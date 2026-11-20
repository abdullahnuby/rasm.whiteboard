import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = vm.createContext({ Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int16Array, Int32Array, Float32Array, Map, WeakMap, Math, Number, TypeError, Array, Object });
vm.runInContext(await readFile('dist/motion.js', 'utf8'), context);
vm.runInContext(await readFile('dist/engine.js', 'utf8'), context);

// Integration: real engine paths (fractional coordinates) must feed colorSchedule.
const W = 240, H = 160, pixels = new Uint8ClampedArray(W * H * 4).fill(255);
const dot = (x, y, c) => { const p = (y * W + x) * 4; pixels[p] = pixels[p + 1] = pixels[p + 2] = c; };
for (let y = 30; y < 100; y++) for (let x = 40; x < 120; x++) dot(x, y, 40);
for (let a = 0; a < 6.283; a += 0.002) dot(Math.round(180 + 35 * Math.cos(a)), Math.round(95 + 35 * Math.sin(a)), 0);
const result = context.RasmImageEngine.extractPaths(pixels, W, H);
assert.ok(result.lines.length > 0);
assert.ok(result.lines.some(l => l.points.some(p => !Number.isInteger(p[0]) || !Number.isInteger(p[1]))), 'Test must exercise fractional points');

context.scene = { src: { width: W, height: H }, lines: result.lines, length: result.length };
// The timeout turns the former infinite loop into a test failure instead of a hang.
const plan = vm.runInContext('colorSchedule(scene)', context, { timeout: 5000 });
const n = W * H;
assert.equal(plan.order.length, n);
assert.equal(plan.ends[256], n, 'Every pixel needs a reveal time');
let used = 0;
for (let t = 0; t < 256; t++) if (plan.ends[t + 1] > plan.ends[t]) used++;
assert.ok(used > 100, 'Reveal times should spread across the timeline');
assert.equal(vm.runInContext('colorSchedule(scene)', context), plan, 'Schedule should be memoized per scene');
console.log('RASM schedule tests passed.');
