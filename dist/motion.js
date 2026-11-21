'use strict';

function edgeSkinRegion(data,w,h){
 const step=Math.max(1,Math.round(Math.max(w,h)/96)),cols=Math.ceil(w/step),rows=Math.ceil(h/step);
 const mask=new Uint8Array(cols*rows),queue=new Int32Array(mask.length);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const p=4*(y*step*w+x*step),r=data[p],g=data[p+1],b=data[p+2];
  if(r>55&&r-g>10&&r>b*1.17&&g>b*.98&&r-g<110&&g-b<80)mask[y*cols+x]=1;
 }
 for(let i=0;i<mask.length;i++){
  if(!mask[i])continue;let head=0,tail=1,edge=0;queue[0]=i;mask[i]=0;
  while(head<tail){const p=queue[head++],x=p%cols,y=Math.floor(p/cols);if(!x||!y||x===cols-1||y===rows-1)edge++;
   for(const j of [x?p-1:-1,x<cols-1?p+1:-1,y?p-cols:-1,y<rows-1?p+cols:-1])if(j>=0&&mask[j]){mask[j]=0;queue[tail++]=j}
  }
  if(tail/mask.length>=.065&&edge>=Math.max(2,Math.min(cols,rows)*.06))return true;
 }
 return false;
}
function overlayEnabled(scene){
 return scene.tone!==2&&scene.sourceHand!=='present'&&(scene.sourceHand!=='detect'||!scene.handHint);
}

// The UI shell is only an adapter. Engine v2 owns all image and path analysis.
function applyZones(scene){
 if(!globalThis.RasmWhiteboardCore)throw new Error('RASM Engine v2 is not loaded.');
 return globalThis.RasmWhiteboardCore.applyToLegacyScene(scene).plan;
}

const revealSchedules=new WeakMap(),revealQueued=new WeakSet(),revealErrors=new WeakMap(),revealJobs=new Map();
let revealWorker=null,revealRequestId=0;

function buildColorSchedule(scene){
 if(!globalThis.RasmWhiteboardCore)throw new Error('RASM Engine v2 is not loaded.');
 return globalThis.RasmWhiteboardCore.buildLegacyRevealSchedule(scene);
}
function rememberSchedule(scene,plan){
 revealSchedules.set(scene.lines,{width:scene.src.width,height:scene.src.height,plan});
 revealErrors.delete(scene.lines);revealQueued.delete(scene.lines);
}
function buildSynchronousSchedule(scene){
 try{const plan=buildColorSchedule(scene);rememberSchedule(scene,plan);return plan}
 catch(error){revealErrors.set(scene.lines,error);revealQueued.delete(scene.lines);throw error}
}
function failRevealWorker(){
 revealWorker?.terminate();revealWorker=null;
 for(const [id,job] of revealJobs){
  revealJobs.delete(id);
  try{buildSynchronousSchedule(job.scene)}catch(error){revealErrors.set(job.lines,error)}
 }
}
function getRevealWorker(){
 if(typeof Worker!=='function')return null;
 if(revealWorker)return revealWorker;
 try{
  revealWorker=new Worker('motion-worker.js');
  revealWorker.onmessage=event=>{
   const job=revealJobs.get(event.data.id);if(!job)return;
   revealJobs.delete(event.data.id);revealQueued.delete(job.lines);
   if(event.data.error){try{buildSynchronousSchedule(job.scene)}catch(error){revealErrors.set(job.lines,error)};return}
   revealSchedules.set(job.lines,{width:job.width,height:job.height,plan:event.data.plan});
  };
  revealWorker.onerror=failRevealWorker;
  return revealWorker;
 }catch{return null}
}
function requestColorSchedule(scene){
 const lines=scene.lines,width=scene.src.width,height=scene.src.height;
 if(revealSchedules.has(lines)||revealQueued.has(lines))return;
 const worker=getRevealWorker();
 if(!worker){buildSynchronousSchedule(scene);return}
 const labels=scene.rasterLabels;
 if(!(labels instanceof Uint32Array)||labels.length!==width*height)throw new Error('RASM Engine v2: raster ownership labels are missing or invalid.');
 const id=++revealRequestId;revealQueued.add(lines);revealJobs.set(id,{scene,lines,width,height});
 try{
  const rasterLabels=labels.slice();
  worker.postMessage({
   id,width,height,totalDistance:scene.totalDistance,
   lines:lines.map(line=>({
    id:line.id,start:line.start,elementId:line.elementId,shapeId:line.shapeId,
    componentId:line.componentId,source:line.source,points:line.points
   })),
   rasterLabels,
   shapeGroups:(scene.shapeGroups||[]).map(group=>({id:group.id,rasterComponentLabels:group.rasterComponentLabels||[]}))
  },[rasterLabels.buffer]);
 }catch{
  revealJobs.delete(id);revealQueued.delete(lines);buildSynchronousSchedule(scene);
 }
}
function colorSchedule(scene){
 const cached=revealSchedules.get(scene.lines);
 if(cached&&cached.width===scene.src.width&&cached.height===scene.src.height)return cached.plan;
 const error=revealErrors.get(scene.lines);if(error)throw error;
 requestColorSchedule(scene);
 return revealSchedules.get(scene.lines)?.plan||null;
}
async function prepareColorSchedule(scene){
 if(scene.mode!=='original')return null;
 const deadline=Date.now()+30000;
 while(!colorSchedule(scene)){
  const error=revealErrors.get(scene.lines);if(error)throw error;
  if(Date.now()>deadline){
   failRevealWorker();
   if(!revealSchedules.has(scene.lines))buildSynchronousSchedule(scene);
   break;
  }
  await new Promise(resolve=>setTimeout(resolve,12));
 }
 const plan=revealSchedules.get(scene.lines)?.plan;
 if(!plan)throw new Error('RASM Engine v2 could not prepare a complete reveal schedule.');
 return plan;
}
function revealPixels(layer,fraction){
 const count=layer.ends[Math.min(256,Math.max(0,Math.floor(256*fraction)))];
 if(count===layer.count)return false;
 if(count<layer.count){layer.output.fill(0);layer.count=0}
 for(let i=layer.count;i<count;i++){const pixel=layer.order[i];layer.output[pixel]=layer.source[pixel]}
 layer.count=count;return true;
}
function sceneSeconds(scene){return scene.duration/(scene.speed||1)}

const physicalTravelPlans=new WeakMap();
function strokeProgress(scene,fraction){
 if(!scene.lines.length)return {target:0,tip:null,drawing:false,progress:Math.max(0,Math.min(1,fraction||0))};
 let plan=physicalTravelPlans.get(scene.lines);
 if(!plan){
  let end=0,previous=null;
  const segments=scene.lines.map(line=>{
   const points=line.points,first=points[0],cumulative=new Float64Array(points.length);
   for(let i=1;i<points.length;i++)cumulative[i]=cumulative[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
   const gap=previous?Math.hypot(first[0]-previous[0],first[1]-previous[1]):0;
   const begin=end,draw=begin+gap,stroke=Math.max(.01,cumulative.at(-1));
   end=draw+stroke;const segment={begin,draw,end,previous,first,line,cumulative};
   previous=points.at(-1);return segment;
  });
  plan={segments,end};physicalTravelPlans.set(scene.lines,plan);
 }
 if(!plan.segments.length)return {target:0,tip:null,drawing:false,progress:0};
 const progress=Math.min(1,Math.max(0,Number.isFinite(fraction)?fraction:0)),travelled=progress*plan.end;
 let low=0,high=plan.segments.length-1;
 while(low<high){const mid=(low+high)>>1;if(travelled>=plan.segments[mid].end)low=mid+1;else high=mid}
 const segment=plan.segments[low];
 if(travelled<segment.draw){
  const ratio=segment.draw>segment.begin?(travelled-segment.begin)/(segment.draw-segment.begin):1;
  const tip=segment.previous?segment.first.map((v,i)=>segment.previous[i]+(v-segment.previous[i])*ratio):segment.first;
  return {target:segment.line.start,tip,drawing:false,progress};
 }
 if(progress===1)return {target:scene.length,tip:segment.line.points.at(-1),drawing:false,progress:1};
 const along=Math.max(0,travelled-segment.draw),cumulative=segment.cumulative;
 let left=0,right=cumulative.length-1;
 while(left<right){const mid=(left+right)>>1;if(cumulative[mid]>along)right=mid-1;else left=mid}
 const a=segment.line.points[left],b=segment.line.points[Math.min(left+1,cumulative.length-1)];
 const span=cumulative[left+1]===undefined?0:cumulative[left+1]-cumulative[left],ratio=span?Math.min(1,(along-cumulative[left])/span):0;
 return {target:Math.min(scene.length,segment.line.start+left+ratio),tip:a.map((v,i)=>v+(b[i]-v)*ratio),drawing:true,progress};
}
