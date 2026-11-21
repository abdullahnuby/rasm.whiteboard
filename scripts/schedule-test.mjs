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
// Exercise the full schedule algorithm directly; the UI now runs it in a Worker.
const plan = vm.runInContext('buildColorSchedule(scene)', context, { timeout: 5000 });
const n = W * H;
assert.equal(plan.order.length, n);
assert.equal(plan.ends[256], n, 'Every pixel needs a reveal time');
let used = 0;
for (let t = 0; t < 256; t++) if (plan.ends[t + 1] > plan.ends[t]) used++;
assert.ok(used > 100, 'Reveal times should spread across the timeline');

// Sparse and dense samples of the same physical route must share the same
// physical-time mapping. The old point-index schedule advanced too quickly
// through sparsely sampled sections and drifted away from the hand.
const revealScene={
 src:{width:128,height:32},
 lines:[{start:0,points:[[10,16],[11,16],[90,16],[110,16]]}],
 length:4
};
const revealPlan=vm.runInContext('buildColorSchedule(revealScene)',Object.assign(context,{revealScene}),{timeout:5000});
const pixelTimes=new Uint16Array(128*32);
for(let t=0;t<256;t++)for(let k=revealPlan.ends[t];k<revealPlan.ends[t+1];k++)pixelTimes[revealPlan.order[k]]=t;
assert.equal(pixelTimes[16*128+11],2);
assert.equal(pixelTimes[16*128+90],204);
assert.equal(pixelTimes[16*128+110],255);

// The same raster route is now segmented into two separate shapes. Pixels in
// the second object must not be claimed by the first object's flood fill.
const groupedScene={
 src:{width:24,height:8},
 lines:[
  {start:0,shapeId:1,points:[[2,3],[3,3]]},
  {start:2,shapeId:1,points:[[4,4],[5,4]]},
  {start:4,shapeId:2,points:[[15,3],[16,3]]}
 ],
 length:6,shapeSequence:'smart',
 shapeGroups:[
  {id:1,rasterComponentLabels:[1,3]},
  {id:2,rasterComponentLabels:[2]}
 ],
 rasterLabels:new Uint16Array(24*8)
};
for(let y=2;y<=4;y++)for(let x=1;x<=5;x++)groupedScene.rasterLabels[y*24+x]=1;
for(let y=2;y<=4;y++)for(let x=13;x<=18;x++)groupedScene.rasterLabels[y*24+x]=2;
const groupedPlan=vm.runInContext('buildColorSchedule(groupedScene)',Object.assign(context,{groupedScene}),{timeout:5000});
const groupedTimes=new Uint16Array(24*8);
for(let t=0;t<256;t++)for(let k=groupedPlan.ends[t];k<groupedPlan.ends[t+1];k++)groupedTimes[groupedPlan.order[k]]=t;
const groupedTravel=vm.runInContext('strokeTravelPlan(groupedScene.lines)',context,{timeout:5000});
const firstShapeTimes=[],secondShapeTimes=[];
for(let p=0;p<groupedScene.rasterLabels.length;p++){
 const label=groupedScene.rasterLabels[p],t=groupedTimes[p];
 if(label===1||label===3)firstShapeTimes.push(t);
 if(label===2)secondShapeTimes.push(t);
}
assert.ok(Math.max(...firstShapeTimes)<Math.min(...secondShapeTimes),
 'Every pixel in the first shape must finish revealing before the next shape starts');

const firstGroupSegments=groupedTravel.segments.filter(segment=>segment.line.shapeId===1);
const expectedFirstEnd=Math.floor(255*firstGroupSegments.at(-1).end/groupedTravel.end);
assert.equal(Math.max(...firstShapeTimes),expectedFirstEnd,
 'The first shape must finish exactly at the hand path end of its last stroke');

// Without Worker support, the synchronous fallback must rebuild a route-aware
// reveal plan rather than returning the old global row-major pixel order.
const fallback = vm.runInContext('colorSchedule(scene)', context, { timeout: 5000 });
assert.equal(fallback.linear, undefined, 'Fallback must not use global row-major reveal');
assert.equal(fallback.order.length, n, 'Fallback must produce a complete pixel order');
assert.equal(fallback.ends[256], n, 'Fallback must assign a reveal time to every pixel');
assert.equal(vm.runInContext('colorSchedule(scene)', context), fallback, 'Fallback should be memoized per scene');
// The first animation frame can be timestamped slightly before `start`, giving a negative fraction.
for (const f of [-0.5, -1e-6, NaN, 0, 1, 2]) {
  context.f = f;
  const step = vm.runInContext('strokeProgress(scene, f)', context, { timeout: 5000 });
  assert.ok(Number.isFinite(step.target) && step.target >= 0, 'strokeProgress must tolerate fraction ' + f);
}
console.log('RASM schedule tests passed.');
