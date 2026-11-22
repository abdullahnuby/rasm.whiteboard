import test from 'node:test';import assert from 'node:assert/strict';
import {createScenePlan,createProjectPlan,projectFrameAt,poseAt,renderFrame,createOutlineMask,revealPhaseAt} from '../../.build/editor.js';
const metadata={id:'scene',assetId:'image',revision:0,name:'test',duration:1,speed:1,motionStyle:'smart',elementDirection:'rtl',mode:'original',tone:2,side:'1',hold:0,paper:'#ffffff',transition:'cut',sourceHand:'clean',handSize:100,weight:1.4,zones:[]};
const drawing={width:4,height:4,lines:[{start:0,points:[[0,0],[3,3]],elementId:1}],length:2};
const pixels={order:Uint32Array.from({length:16},(_,i)=>i),ends:Uint32Array.from({length:257},(_,i)=>Math.floor(i/16))};
function target(){
 const noop=()=>{};const context={save:noop,restore:noop,setTransform:noop,clearRect:noop,fillRect:noop,translate:noop,scale:noop,drawImage:noop};
 const captured=[];const layer={...context,putImageData(image){captured.push(Array.from(image.data))}};
 return {context,width:4,height:4,source:{image:{},width:4,height:4},sourcePixels:new Uint8ClampedArray(64).fill(255),scratch:{image:{},context:layer,pixels:{data:new Uint8ClampedArray(64)}},hands:{},captured};
}
test('canonical scene plans structured-clone without DOM resources and use bounded travel sampling',()=>{
 const plan=createScenePlan(metadata,drawing,pixels);const copy=structuredClone(plan);assert.equal(copy.sceneId,'scene');
 for(const fraction of [0,.001,.1,.5,.99,1])assert.ok(Number.isFinite(poseAt(copy,fraction).target));
 assert.deepEqual(poseAt(copy,.5).tip,[1.5,1.5]);assert.throws(()=>createScenePlan(metadata,drawing,null));
});
test('rendering is independent of previous frames and supports backwards scrubbing',()=>{
 const plan=createScenePlan(metadata,drawing,pixels),a=target(),b=target();renderFrame(plan,.5,a);renderFrame(plan,.9,b);renderFrame(plan,.1,b);renderFrame(plan,.5,b);
 assert.deepEqual(a.captured.at(-1),b.captured.at(-1));assert.equal(a.captured.at(-1).filter(x=>x!==0).length,8*4);
});
test('project snapshot timing is exact at scene boundaries and end',()=>{
 const a=createScenePlan(metadata,drawing,pixels),b=createScenePlan({...metadata,id:'second',duration:2},drawing,pixels);const project=createProjectPlan([a,b]);
 assert.equal(project.durationSeconds,3);assert.equal(projectFrameAt(project,.999).plan.sceneId,'scene');assert.equal(projectFrameAt(project,1).plan.sceneId,'second');assert.equal(projectFrameAt(project,1).local,0);assert.equal(projectFrameAt(project,3).local,2);
 assert.equal(projectFrameAt(createProjectPlan([]),0),null);assert.equal(projectFrameAt(project,-1).local,0);
});

test('outline/color is source-derived, deterministic, and ends in exact original pixels',()=>{const plan=createScenePlan({...metadata,revealMode:'outline-color'},drawing,pixels),a=target(),b=target();for(const p of [5,6,9,10])a.sourcePixels.set([60,130,180,255],p*4);a.outlineMask=createOutlineMask(a.sourcePixels,4,4);b.sourcePixels=a.sourcePixels.slice();b.outlineMask=a.outlineMask;assert.ok(a.outlineMask.some(Boolean));renderFrame(plan,.3,a);renderFrame(plan,.9,b);renderFrame(plan,.3,b);assert.deepEqual(a.captured.at(-1),b.captured.at(-1));assert.equal(revealPhaseAt(plan,.3).color,0);const transfer=revealPhaseAt(plan,.61).transfer;assert.ok(transfer&&transfer.ratio>=0&&transfer.ratio<=1);renderFrame(plan,1,a);assert.deepEqual(a.captured.at(-1),Array.from(a.sourcePixels));assert.throws(()=>renderFrame(plan,.2,target()),/Outline/)});
