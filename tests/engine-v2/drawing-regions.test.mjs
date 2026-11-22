import test from 'node:test';import assert from 'node:assert/strict';
import {analyzeRaster,partitionDrawingRegions,buildDrawingPlan,buildRevealSchedule} from '../../.build/index.js';
function fixture(){const width=24,height=12,pixels=new Uint8ClampedArray(width*height*4).fill(255);for(let y=3;y<=8;y++)for(let x=2;x<=21;x++)pixels.set([0,0,0,255],(y*width+x)*4);return analyzeRaster(pixels,width,height)}
const zones=[{x:0,y:0,w:.5,h:1},{x:.5,y:0,w:.5,h:1}];
test('manual regions split a connected illustration into author-owned elements without losing pixels',()=>{
 const analysis=fixture(),original=analysis.rasterLabels.slice(),partitioned=partitionDrawingRegions(analysis,zones);
 assert.equal(partitioned.elements.length,2);assert.equal(partitioned.components.length,2);assert.deepEqual(analysis.rasterLabels,original);
 for(let i=0;i<original.length;i++)assert.equal(partitioned.rasterLabels[i]!==0,original[i]!==0);
 assert.equal(partitioned.components.reduce((n,c)=>n+c.area,0),120);assert.equal(partitionDrawingRegions(analysis,[]),analysis);
});
test('earlier overlapping regions win and the remainder stays outside forced groups',()=>{
 const analysis=fixture(),p=partitionDrawingRegions(analysis,[{x:.2,y:0,w:.6,h:1},{x:0,y:0,w:1,h:1}]);
 const pixel=p.rasterLabels[5*24+12],owner=p.elements.find(e=>e.componentIds.includes(pixel));assert.equal(owner.manualZone,0);
 assert.ok(p.elements.some(e=>e.manualZone===1));assert.throws(()=>partitionDrawingRegions(analysis,[{x:NaN,y:0,w:1,h:1}]));
});
test('normalized manual ordering overrides RTL and schedules one region completely before the next',()=>{
 const analysis=fixture();const points=Array.from({length:20},(_,i)=>[i+2,5]);
 const plan=buildDrawingPlan(analysis,[{points}],[],{direction:'rtl',zones});
 assert.deepEqual(plan.elements.map(e=>e.manualZone),[0,1]);assert.ok(plan.diagnostics.splitPaths>0);
 const schedule=buildRevealSchedule({width:24,height:12,totalDistance:plan.totalDistance,lines:plan.lines,rasterLabels:plan.rasterLabels,shapeGroups:plan.elements.map(e=>({id:e.id,rasterComponentLabels:e.componentIds}))});
 assert.equal(schedule.diagnostics.unscheduledPixels,0);assert.deepEqual(schedule.diagnostics.unseededComponents,[]);
 const [a,b]=schedule.elementWindows;assert.ok(a.end<=b.start);
 const automatic=buildDrawingPlan(analysis,[{points}],[],{direction:'rtl'});assert.equal(automatic.elements.length,1);
});
test('unselected details retain the calculated reading order after author regions',async()=>{
 const {orderElements}=await import('../../.build/index.js');
 const element=(id,x,manualZone)=>({id,orderIndex:id-1,bounds:{x,y:0,width:1,height:1,cx:x,cy:0},manualZone});
 const items=[element(1,2,-1),element(2,9,-1),element(3,5,0)];
 assert.deepEqual(orderElements(items,'rtl',[{x:0,y:0,w:1,h:1}]).map(e=>e.id),[3,2,1]);
});
