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

// Plan generation is kept off the UI thread. The image Worker owns the expensive
// component/path assignment and route planning work.
async function applyZones(scene){
 if(!globalThis.RasmImageEngine?.planAsync)throw new Error('RASM image Worker is not available.');
 return globalThis.RasmImageEngine.planAsync(scene);
}

const revealSchedules=new WeakMap(),revealQueued=new WeakSet(),revealErrors=new WeakMap(),revealJobs=new Map();
let revealWorker=null,revealRequestId=0;

function buildColorSchedule(scene){ return colorSchedule(scene); }
const revealSchedules=new WeakMap(),revealQueued=new WeakSet(),revealErrors=new WeakMap(),revealJobs=new Map();
let revealWorker=null,revealRequestId=0;

function failRevealWorker(reason){
 const failure=reason instanceof Error?reason:new Error(String(reason||'Reveal Worker stopped unexpectedly.'));
 const failed=revealWorker;revealWorker=null;
 try{failed?.terminate()}catch{}
 for(const [id,job] of revealJobs){
  clearTimeout(job.timer);
  revealJobs.delete(id);
  revealQueued.delete(job.lines);
  revealErrors.set(job.lines,failure);
 }
}
function getRevealWorker(){
 if(typeof Worker!=='function')return null;
 if(revealWorker)return revealWorker;
 try{
  revealWorker=new Worker('motion-worker.js');
  revealWorker.onmessage=event=>{
   const job=revealJobs.get(event.data.id);if(!job)return;
   revealJobs.delete(event.data.id);clearTimeout(job.timer);revealQueued.delete(job.lines);
   if(event.data.error){
    revealErrors.set(job.lines,new Error('Reveal Worker could not build the pixel schedule: '+String(event.data.error)));
    return;
   }
   if(!event.data.plan?.order||!event.data.plan?.ends){
    revealErrors.set(job.lines,new Error('Reveal Worker returned an incomplete pixel schedule.'));
    return;
   }
   revealSchedules.set(job.lines,{width:job.width,height:job.height,plan:event.data.plan});
  };
  revealWorker.onerror=event=>{
   const detail=event?.message||event?.error?.message||'unknown worker error';
   failRevealWorker(new Error('Reveal Worker crashed: '+detail));
  };
  revealWorker.onmessageerror=()=>failRevealWorker(new Error('Reveal Worker returned an unreadable message.'));
  return revealWorker;
 }catch{return null}
}
function requestColorSchedule(scene){
 const lines=scene.lines,width=scene.src.width,height=scene.src.height;
 if(revealSchedules.has(lines)||revealQueued.has(lines))return;
 const worker=getRevealWorker();
 if(!worker){
  const error=new Error('المتصفح لم يتمكن من تشغيل Worker الخاص بجدولة البكسلات. لم يتم تشغيل بديل متزامن حتى لا تتجمد الصفحة.');
  revealErrors.set(lines,error);throw error;
 }
 const labels=scene.rasterLabels;
 if(!(labels instanceof Uint32Array)||labels.length!==width*height){
  const error=new Error('RASM Engine v2: raster ownership labels are missing or invalid.');
  revealErrors.set(lines,error);throw error;
 }
 const id=++revealRequestId;revealQueued.add(lines);
 const job={scene,lines,width,height,timer:null};
 job.timer=setTimeout(()=>{
  if(!revealJobs.has(id))return;
  failRevealWorker(new Error('انتهت مهلة جدولة البكسلات بعد 90 ثانية. أوقفت المهمة بدل تجميد المحرر.'));
 },90000);
 revealJobs.set(id,job);
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
 }catch(error){
  failRevealWorker(new Error('تعذّر إرسال خطة المشهد إلى Reveal Worker: '+String(error?.message||error)));
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
 const deadline=Date.now()+95000;
 while(true){
  const plan=colorSchedule(scene);
  if(plan)return plan;
  const error=revealErrors.get(scene.lines);if(error)throw error;
  if(Date.now()>deadline){
   const error=new Error('محرك جدولة البكسلات لم يستجب خلال 95 ثانية.');
   failRevealWorker(error);throw error;
  }
  await new Promise(resolve=>setTimeout(resolve,20));
 }
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
