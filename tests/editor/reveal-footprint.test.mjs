import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRevealSchedule} from '../../.build/index.js';
import {createMotionPlan,poseAt} from '../../.build/editor.js';

test('fine reveal bins keep a short stroke near the pen in a long automatic route',()=>{
 const width=1024,height=20,rasterLabels=new Uint32Array(width*height);
 for(let x=4;x<=1000;x++){rasterLabels[5*width+x]=1;rasterLabels[15*width+x]=2}
 const first=Array.from({length:997},(_,i)=>[i+4,5]);
 const second=Array.from({length:21},(_,i)=>[i%2?4:1000,15]);
 const lines=[{id:'short',start:0,elementId:1,componentId:1,points:first},{id:'long',start:first.length,elementId:2,componentId:2,points:second}];
 const motion=createMotionPlan(lines,first.length+second.length);
 function p95(resolution){
  const schedule=buildRevealSchedule({width,height,rasterLabels,lines,totalDistance:motion.totalDistance,resolution,revealSpread:'near-pen',shapeGroups:[{id:1,rasterComponentLabels:[1]},{id:2,rasterComponentLabels:[2]}]}),distances=[];
  for(let bin=0;bin<resolution;bin++){
   const pose=poseAt(motion,(bin+1)/resolution);
   for(let i=schedule.ends[bin];i<schedule.ends[bin+1];i++){
    const p=schedule.order[i];if(rasterLabels[p]!==1)continue;
    distances.push(Math.hypot(p%width-pose.tip[0],Math.floor(p/width)-pose.tip[1]));
   }
  }
  assert.equal(schedule.diagnostics.unscheduledPixels,0);
  assert.equal(distances.length,997);
  distances.sort((a,b)=>a-b);return distances[Math.floor(distances.length*.95)];
 }
 assert.ok(p95(256)>50,'The coarse-bin fixture must reproduce the reveal/pen mismatch.');
 assert.ok(p95(65536)<1,'The fine schedule must keep this source stroke within one analysis pixel of the pen.');
});
