import test from 'node:test';
import assert from 'node:assert/strict';
import {ElementDocument,elementAnalysis,createScenePlan,renderFrame,createOutlineMask} from '../../.build/editor.js';
import {analyzeRaster,buildDrawingPlan,buildRevealSchedule} from '../../.build/index.js';
const width=24,height=12,source=new Uint8ClampedArray(width*height*4).fill(255);
for(let y=3;y<9;y++)for(let x=2;x<22;x++)source.set([10,70,30,255],(y*width+x)*4);
// A faint JPEG-like halo outside foreground must not reveal future artwork.
source.set([248,249,250,255],(1*width+20)*4);
const base=analyzeRaster(source,width,height),document=new ElementDocument(width,height,base.rasterLabels);
document.add(Uint8Array.from(base.rasterLabels,(_,p)=>p%width<9?1:0),'first');
document.add(Uint8Array.from(base.rasterLabels,(_,p)=>p%width>=9&&p%width<16?1:0),'second');
const drawing=buildDrawingPlan(elementAnalysis(base,document.snapshot),[{points:[[2,5],[21,5]]}],[],{direction:'rtl'});
const schedule=buildRevealSchedule({width,height,resolution:65536,revealSpread:'near-pen',totalDistance:drawing.totalDistance,lines:drawing.lines,rasterLabels:drawing.rasterLabels,shapeGroups:drawing.elements.map(e=>({id:e.id,rasterComponentLabels:e.componentIds}))});
const metadata={id:'s',assetId:'i',revision:1,name:'s',duration:4,speed:1,hold:0,mode:'original',paper:'#ffffff',weight:1,tone:2,side:'1',handSize:100,sourceHand:'clean',transition:'cut'};
function target(){
 const noop=()=>{},context={save:noop,restore:noop,setTransform:noop,clearRect:noop,fillRect:noop,translate:noop,scale:noop,drawImage:noop,putImageData:noop};
 return {context,width,height,source:{image:{},width,height},sourcePixels:source,outlineMask:createOutlineMask(source,width,height),scratch:{image:{},context,pixels:{data:new Uint8ClampedArray(source.length)}},hands:{}};
}
for(const revealMode of ['direct','outline-color'])test(`${revealMode}: ownership wins over quantized bins at every authored boundary`,()=>{
 const plan=createScenePlan({...metadata,revealMode},drawing,schedule),a=target(),b=target();
 assert.ok(plan.elementOwnership);
 assert.equal(plan.elementOwnership.labels,drawing.rasterLabels,'The rank table must reuse immutable labels, not duplicate the raster.');
 const fractions=[0,.01,.1,...plan.elementTiming.flatMap(window=>[window.end-1e-8,window.end,Math.min(1,window.end+1e-8)]),1];
 for(const fraction of fractions){
  renderFrame(plan,fraction*plan.durationSeconds,a);
  const activeIndex=fraction>=1?plan.elementTiming.length:plan.elementTiming.findIndex(window=>fraction<window.end),rank=activeIndex+1,output=a.scratch.pixels.data;
  for(let p=0;p<base.rasterLabels.length;p++){
   const owner=plan.elementOwnership.ranks[plan.elementOwnership.labels[p]];
   if(!owner){if(fraction<1)assert.equal(output[p*4+3],0,'Background halos must not expose later objects.');continue}
   if(owner<rank)assert.deepEqual(output.slice(p*4,p*4+4),source.slice(p*4,p*4+4),`Earlier element incomplete at ${fraction}, pixel ${p}`);
   if(owner>rank)assert.equal(output[p*4+3],0,`Later element appeared early at ${fraction}, pixel ${p}`);
  }
 }
 renderFrame(plan,.2*plan.durationSeconds,a);renderFrame(plan,.9*plan.durationSeconds,b);renderFrame(plan,.2*plan.durationSeconds,b);
 assert.deepEqual(a.scratch.pixels.data,b.scratch.pixels.data,'Ownership clipping must remain deterministic when scrubbing backwards.');
 renderFrame(plan,plan.durationSeconds,a);assert.deepEqual(a.scratch.pixels.data,source);
});
