'use strict';
// Detect a large, warm-coloured region connected to a frame edge. This is a
// conservative hint for photographed hands, not an object recognition model.
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
 }return false
}
function overlayEnabled(s){return s.tone!==2&&s.sourceHand!=='present'&&(s.sourceHand!=='detect'||!s.handHint)}
// Original-colour scenes can reveal fine detail without sending the marker
// through every texture fragment. Line-only modes retain their full paths.
function principalStrokes(lines,width,height){
 if(lines.length<36)return lines;
 const ranked=lines.map((line,index)=>{
  let distance=0;
  for(let i=1;i<line.points.length;i++)distance+=Math.hypot(line.points[i][0]-line.points[i-1][0],line.points[i][1]-line.points[i-1][1]);
  return {line,index,distance}
 }).sort((a,b)=>b.distance-a.distance);
 const budget=Math.hypot(width,height)*3,chosen=new Set();
 let distance=0;
 for(const item of ranked){
  if(chosen.size>=120||(chosen.size>=12&&distance>=budget))break;
  chosen.add(item.index);distance+=item.distance
 }
 return lines.filter((_,index)=>chosen.has(index))
}
function routeStrokes(lines){
 if(lines.length<2)return lines;
 const size=48,buckets=new Map(),remaining=new Set(lines.map((_,i)=>i));
 const key=p=>Math.floor(p[0]/size)+','+Math.floor(p[1]/size);
 lines.forEach((line,index)=>{for(const p of [line.points[0],line.points.at(-1)]){
  const k=key(p);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(index)
 }});
 const ordered=[];let point=lines[0].points[0];
 while(remaining.size){
  const bx=Math.floor(point[0]/size),by=Math.floor(point[1]/size);
  let candidate=-1,distance=Infinity,reverse=false;
  for(let ring=0;ring<4&&candidate<0;ring++){
   for(let x=-ring;x<=ring;x++)for(let y=-ring;y<=ring;y++){
    if(Math.max(Math.abs(x),Math.abs(y))!==ring)continue;
    for(const index of buckets.get((bx+x)+','+(by+y))||[]){
     if(!remaining.has(index))continue;
     const line=lines[index];
     for(const flip of [false,true]){
      const p=flip?line.points.at(-1):line.points[0],d=Math.hypot(p[0]-point[0],p[1]-point[1]);
      if(d<distance){candidate=index;distance=d;reverse=flip}
     }
    }
   }
  }
  if(candidate<0)candidate=remaining.values().next().value;
  remaining.delete(candidate);const line=lines[candidate];
  const next=reverse?{...line,points:line.points.slice().reverse()}:line;
  ordered.push(next);point=next.points.at(-1)
 }
 return ordered
}
function lineCenter(line){
 const points=line.points||[];
 if(!points.length)return [0,0];
 let x=0,y=0,step=Math.max(1,Math.floor(points.length/24)),count=0;
 for(let i=0;i<points.length;i+=step){x+=points[i][0];y+=points[i][1];count++}
 return [x/count,y/count]
}
function fallbackShapeGroups(lines,width,height){
 const groups=[],gap=Math.max(12,Math.min(width,height)*.035);
 for(let index=0;index<lines.length;index++){
  const line=lines[index],center=lineCenter(line);
  let chosen=null,best=Infinity;
  for(const group of groups){const d=Math.hypot(group.center[0]-center[0],group.center[1]-center[1]);if(d<best){best=d;chosen=group}}
  if(chosen&&best<=gap){chosen.lineIndices.push(index);const n=chosen.lineIndices.length;chosen.center=[(chosen.center[0]*(n-1)+center[0])/n,(chosen.center[1]*(n-1)+center[1])/n]}
  else groups.push({id:groups.length+1,lineIndices:[index],center,bounds:null,area:0,source:'path-cluster'})
 }
 return groups
}
function applyZones(scene){
 const center=scene.motionStyle!=='contour'&&Array.isArray(scene.centerBaseLines)&&scene.centerBaseLines.length>0;
 let source=center?scene.centerBaseLines:scene.baseLines;
 if(scene.motionStyle!=='contour'&&scene.mode==='original')source=principalStrokes(source,scene.src.width,scene.src.height);
 const all=center?scene.centerBaseLines:scene.baseLines;
 let groups=[];
 if(scene.shapeSequence!=='strokes'){
  const stored=center?scene.centerShapeGroups:scene.contourShapeGroups;
  const available=new Set(source);
  if(Array.isArray(stored)&&stored.length){
   for(const shape of stored){
    const lines=(shape.lineIndices||[]).map(index=>all[index]).filter(line=>line&&available.has(line));
    lines.forEach(line=>available.delete(line));
    if(lines.length||shape.area>0)groups.push({...shape,lines});
   }
  }
  if(available.size){
   const fallback=fallbackShapeGroups([...available],scene.src.width,scene.src.height);
   for(const item of fallback)groups.push({...item,lines:item.lineIndices.map(index=>[...available][index])});
  }
 }else groups=source.map((line,index)=>({id:index+1,lineIndices:[index],lines:[line],bounds:null,area:0,source:'individual-stroke'}));
 if(!groups.length)groups=fallbackShapeGroups(source,scene.src.width,scene.src.height).map(group=>({...group,lines:group.lineIndices.map(index=>source[index])}));
 // Explicit user zones override automatic object grouping and are played first in the drawn order.
 if(Array.isArray(scene.zones)&&scene.zones.length){
  const remaining=new Set(source),manual=[];
  for(let z=0;z<scene.zones.length;z++){
   const zone=scene.zones[z],picked=[];
   for(const line of source){
    if(!remaining.has(line))continue;
    const [x,y]=lineCenter(line),nx=x/scene.src.width,ny=y/scene.src.height;
    if(nx>=zone.x&&ny>=zone.y&&nx<=zone.x+zone.w&&ny<=zone.y+zone.h){picked.push(line);remaining.delete(line)}
   }
   if(picked.length)manual.push({id:'zone-'+(z+1),lines:picked,bounds:{x:zone.x*scene.src.width,y:zone.y*scene.src.height,width:zone.w*scene.src.width,height:zone.h*scene.src.height},area:0,source:'user-zone'});
  }
  const rest=[];
  for(const shape of groups){
   const lines=(shape.lines||[]).filter(line=>remaining.has(line));
   if(lines.length)rest.push({...shape,lines});
  }
  const assigned=new Set(rest.flatMap(shape=>shape.lines));
  for(const line of remaining)if(!assigned.has(line))rest.push({id:'remaining-'+rest.length,lines:[line],bounds:null,area:0,source:'remaining-stroke'});
  groups=[...manual,...rest];
 }
 let start=0;
 scene.shapeGroups=[];
 scene.lines=[];
 groups.forEach((shape,index)=>{
  const routed=routeStrokes(shape.lines||[]);
  const pathStart=start;
  for(const line of routed){
   const result={...line,start,shapeId:index+1};
   scene.lines.push(result);start+=line.points.length;
  }
  let travelLength=0;
  for(const line of routed)for(let i=1;i<line.points.length;i++)travelLength+=Math.hypot(line.points[i][0]-line.points[i-1][0],line.points[i][1]-line.points[i-1][1]);
  scene.shapeGroups.push({
   id:index+1,name:shape.name||('شكل '+(index+1)),bounds:shape.bounds||null,
   area:shape.area||0,pathCount:routed.length,pathStart,pathEnd:start,
   travelLength,rasterComponentLabels:[...(shape.componentLabels||[])],
   source:shape.source||'detected-component'
  });
 });
 scene.length=start;scene.usingCenterline=center;
 scene.shapeMetrics={...(scene.shapeMetrics||{}),sequence:scene.shapeSequence||'smart',orderedShapes:scene.shapeGroups.length,drawnShapes:scene.shapeGroups.filter(group=>group.pathCount>0).length};
}

// Map each source pixel to a reveal time. Interior pixels follow their
// nearest traced edge, so solid fills retain their original RGB values.
const schedules=new WeakMap(),scheduleQueued=new WeakSet(),scheduleJobs=new Map();
let scheduleWorker=null,scheduleJobId=0;
function linearColorSchedule(scene){
 const count=scene.src.width*scene.src.height,ends=new Uint32Array(257);
 for(let t=0;t<=256;t++)ends[t]=Math.floor(count*t/256);
 return {order:null,ends,linear:true}
}
function failScheduleWorker(){
 for(const [id,job] of scheduleJobs){
  scheduleJobs.delete(id);scheduleQueued.delete(job.lines);
  schedules.set(job.lines,{w:job.width,h:job.height,plan:linearColorSchedule(job.scene)});
 }
 scheduleWorker?.terminate();scheduleWorker=null;
}
function getScheduleWorker(){
 if(typeof Worker!=='function')return null;
 if(scheduleWorker)return scheduleWorker;
 try{
  scheduleWorker=new Worker('motion-worker.js');
  scheduleWorker.onmessage=event=>{
   const job=scheduleJobs.get(event.data.id);if(!job)return;
   scheduleJobs.delete(event.data.id);scheduleQueued.delete(job.lines);
   const plan=event.data.error?linearColorSchedule(job.scene):event.data.plan;
   schedules.set(job.lines,{w:job.width,h:job.height,plan});
  };
  scheduleWorker.onerror=failScheduleWorker;
  return scheduleWorker;
 }catch{return null}
}
function requestColorSchedule(scene){
 const lines=scene.lines,width=scene.src.width,height=scene.src.height;
 if(scheduleQueued.has(lines))return;
 const worker=getScheduleWorker();
 if(!worker){schedules.set(lines,{w:width,h:height,plan:linearColorSchedule(scene)});return}
 const id=++scheduleJobId;scheduleQueued.add(lines);scheduleJobs.set(id,{scene,lines,width,height});
 try{
  const rasterLabels=scene.rasterLabels?.length===width*height?scene.rasterLabels.slice():null;
  const payload={id,width,height,length:scene.length,lines:lines.map(line=>({start:line.start,points:line.points})),rasterLabels};
  worker.postMessage(payload,rasterLabels?[rasterLabels.buffer]:[]);
 }catch{
  scheduleJobs.delete(id);scheduleQueued.delete(lines);
  schedules.set(lines,{w:width,h:height,plan:linearColorSchedule(scene)});
 }
}
function colorSchedule(scene){
 const cached=schedules.get(scene.lines);
 if(cached&&cached.w===scene.src.width&&cached.h===scene.src.height)return cached.plan;
 requestColorSchedule(scene);return schedules.get(scene.lines)?.plan||null;
}
function buildColorSchedule(scene){
 const w=scene.src.width,h=scene.src.height,n=w*h;
 const times=new Uint8Array(n),seen=new Uint8Array(n),queue=new Uint32Array(n);
 const labels=scene.rasterLabels?.length===n?scene.rasterLabels:null;
 let hasLabels=!!labels;
 if(hasLabels){let foreground=0;for(let p=0;p<n;p++)if(labels[p])foreground++;hasLabels=foreground>0}
 let head=0,tail=0;
 const travel=strokeTravelPlan(scene.lines);
 function nearestLabelPixel(x,y){
  const direct=y*w+x;if(!hasLabels||labels[direct])return direct;
  let best=-1,bestD=Infinity;
  for(let radius=1;radius<=3;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
   const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;
   const p=ny*w+nx;if(!labels[p])continue;
   const d=dx*dx+dy*dy;if(d<bestD){best=p;bestD=d}
  }
  return best
 }
 for(const segment of travel.segments)for(let j=0;j<segment.line.points.length;j++){
  const point=segment.line.points[j],x=Math.min(w-1,Math.max(0,Math.round(point[0]))),y=Math.min(h-1,Math.max(0,Math.round(point[1]))),p=nearestLabelPixel(x,y);
  if(p<0)continue;
  const value=strokeRevealTime(segment,j,travel.end);
  if(!seen[p]){seen[p]=1;times[p]=value;queue[tail++]=p}
  else if(value<times[p])times[p]=value
 }
 if(!tail&&!hasLabels){for(let p=0;p<n;p++)times[p]=Math.floor(255*p/n)}
 while(head<tail){
  const p=queue[head++],x=p%w,label=hasLabels?labels[p]:0;
  for(const k of [x>0?p-1:-1,x+1<w?p+1:-1,p-w,p+w]){
   if(k<0||k>=n||seen[k])continue;
   if(hasLabels&&(!label||labels[k]!==label))continue;
   seen[k]=1;times[k]=Math.min(230,times[p]+1);queue[tail++]=k;
  }
 }
 if(hasLabels){
  for(let p=0;p<n;p++){
   if(labels[p]&&!seen[p])times[p]=230;
   else if(!labels[p])times[p]=255;
  }
  // Give every detected shape its own reveal interval. The first pixel in a
  // shape can appear when its first stroke starts, but its final pixels are
  // guaranteed to reach 100% only when the hand finishes that shape's last
  // stroke. The next shape's interval starts after pen-lift travel.
  if(scene.shapeSequence!=='strokes'&&Array.isArray(scene.shapeGroups)&&scene.shapeGroups.length){
   const windows=new Map();
   for(const group of scene.shapeGroups){
    const owned=travel.segments.filter(segment=>segment.line.shapeId===group.id);
    if(!owned.length)continue;
    windows.set(group.id,{start:owned[0].draw/travel.end,end:owned[owned.length-1].end/travel.end});
   }
   const labelWindows=new Map();
   for(const group of scene.shapeGroups){
    const window=windows.get(group.id);
    if(!window)continue;
    for(const componentLabel of group.rasterComponentLabels||[])labelWindows.set(componentLabel,window);
   }
   const ranges=new Map();
   for(let p=0;p<n;p++){
    const label=labels[p];if(!label||!labelWindows.has(label))continue;
    let range=ranges.get(label);
    if(!range){range={min:255,max:0};ranges.set(label,range)}
    range.min=Math.min(range.min,times[p]);range.max=Math.max(range.max,times[p]);
   }
   for(let p=0;p<n;p++){
    const label=labels[p],window=labelWindows.get(label);if(!window)continue;
    const range=ranges.get(label);
    const local=range&&range.max>range.min?(times[p]-range.min)/(range.max-range.min):1;
    const progress=window.start+Math.max(0,Math.min(1,local))*(window.end-window.start);
    times[p]=Math.min(230,Math.max(0,Math.floor(progress*230)));
   }
  }
 }else if(tail){
  // Legacy full-canvas propagation remains available for photos or low-contrast images.
  for(let p=0;p<n;p++)if(!seen[p])times[p]=255;
 }
 const ends=new Uint32Array(257);
 for(const t of times)ends[t+1]++;
 for(let i=1;i<ends.length;i++)ends[i]+=ends[i-1];
 const cursor=ends.slice(),order=new Uint32Array(n);
 for(let p=0;p<n;p++)order[cursor[times[p]]++]=p;
 return {order,ends}
}
function revealPixels(layer,frac){
 const count=layer.ends[Math.min(256,Math.floor(256*frac))];
 if(count===layer.count)return false;
 if(count<layer.count){layer.output.fill(0);layer.count=0}
 if(layer.linear){for(let i=layer.count;i<count;i++)layer.output[i]=layer.source[i]}
 else for(let i=layer.count;i<count;i++){const p=layer.order[i];layer.output[p]=layer.source[p]}
 layer.count=count;return true
}

function sceneSeconds(scene){return scene.duration/(scene.speed||1)}

// The hand and image reveal share one physical travel timeline, including pen lifts.
const travelPlans=new WeakMap();
function strokeTravelPlan(lines){
 let plan=travelPlans.get(lines);
 if(plan)return plan;
 let end=0,previous=null;
 const segments=lines.map(line=>{
  const points=line.points,first=points[0],cumulative=new Float64Array(points.length);
  for(let i=1;i<points.length;i++)cumulative[i]=cumulative[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
  const gap=previous?Math.hypot(first[0]-previous[0],first[1]-previous[1]):0;
  const begin=end,draw=begin+gap,stroke=Math.max(.01,cumulative.at(-1));
  end=draw+stroke;
  const segment={begin,draw,end,previous,first,line,cumulative};
  previous=points.at(-1);return segment
 });
 plan={segments,end};travelPlans.set(lines,plan);return plan
}
function strokeRevealTime(segment,pointIndex,totalDistance){
 if(!(totalDistance>0))return 0;
 const along=segment.draw+segment.cumulative[Math.min(segment.cumulative.length-1,Math.max(0,pointIndex))];
 return Math.min(230,Math.floor(230*along/totalDistance))
}
function strokeProgress(scene,fraction){
 const plan=strokeTravelPlan(scene.lines);
 if(!plan.segments.length)return {target:0,progress:0};
 const fractionClamped=Math.min(1,Math.max(0,Number.isFinite(fraction)?fraction:0));
 const distance=fractionClamped*plan.end;
 let low=0,high=plan.segments.length-1;
 while(low<high){const mid=(low+high)>>1;if(distance>=plan.segments[mid].end)low=mid+1;else high=mid}
 const seg=plan.segments[low];
 if(distance<seg.draw){
  const t=(distance-seg.begin)/(seg.draw-seg.begin);
  return {target:seg.line.start,tip:seg.first.map((v,i)=>seg.previous[i]+(v-seg.previous[i])*t),drawing:false,progress:fractionClamped}
 }
 if(fractionClamped===1)return {target:scene.length,tip:seg.line.points.at(-1),drawing:false,progress:1};
 const along=Math.max(0,distance-seg.draw),lengths=seg.cumulative;
 let left=0,right=lengths.length-1;
 while(left<right){const mid=Math.ceil((left+right)/2);if(lengths[mid]>along)right=mid-1;else left=mid}
 const a=seg.line.points[left],b=seg.line.points[Math.min(left+1,lengths.length-1)];
 const span=(lengths[left+1]||lengths[left])-lengths[left],ratio=span?Math.min(1,(along-lengths[left])/span):0;
 return {target:Math.min(scene.length,seg.line.start+left+ratio),tip:a.map((v,i)=>v+(b[i]-v)*ratio),drawing:true,progress:fractionClamped}
}
async function prepareColorSchedule(scene){
 if(scene.mode!=='original')return;
 const deadline=Date.now()+15000;
 while(!colorSchedule(scene)){
  if(Date.now()>deadline){failScheduleWorker();schedules.set(scene.lines,{w:scene.src.width,h:scene.src.height,plan:linearColorSchedule(scene)});break}
  await new Promise(resolve=>setTimeout(resolve,15))
 }
}
