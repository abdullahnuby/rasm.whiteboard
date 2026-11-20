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
function applyZones(scene){
 const zones=scene.zones,groups=Array.from({length:zones.length+1},()=>[]);
 for(const line of scene.baseLines){const point=line.points[Math.floor(line.points.length/2)],x=point[0]/scene.src.width,y=point[1]/scene.src.height;
 const idx=zones.findIndex(z=>x>=z.x&&y>=z.y&&x<=z.x+z.w&&y<=z.y+z.h);groups[idx<0?zones.length:idx].push(line)}
 let start=0;scene.lines=groups.flat().map(line=>{const result={...line,start};start+=line.points.length;return result})
}

// Map each source pixel to a reveal time. Interior pixels follow their
// nearest traced edge, so solid fills retain their original RGB values.
const schedules=new WeakMap();
function colorSchedule(scene){
 const cached=schedules.get(scene.lines);
 if(cached&&cached.w===scene.src.width&&cached.h===scene.src.height)return cached.plan;
 const plan=buildColorSchedule(scene);
 schedules.set(scene.lines,{w:scene.src.width,h:scene.src.height,plan});
 return plan
}
function buildColorSchedule(scene){
 const w=scene.src.width,h=scene.src.height,n=w*h;
 const times=new Uint8Array(n),seen=new Uint8Array(n),queue=new Uint32Array(n);
 let head=0,tail=0;
 for(const line of scene.lines)for(let j=0;j<line.points.length;j++){
  const x=Math.min(w-1,Math.max(0,Math.round(line.points[j][0]))),y=Math.min(h-1,Math.max(0,Math.round(line.points[j][1]))),p=y*w+x;
  if(!seen[p]){seen[p]=1;times[p]=Math.floor(230*(line.start+j)/scene.length);queue[tail++]=p}
 }
 if(!tail){for(let p=0;p<n;p++)times[p]=Math.floor(255*p/n)}
 while(head<tail){
  const p=queue[head++],x=p%w;
  for(const k of [x>0?p-1:-1,x+1<w?p+1:-1,p-w,p+w]){
   if(k<0||k>=n||seen[k])continue;
   seen[k]=1;times[k]=Math.min(255,times[p]+1);queue[tail++]=k;
  }
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
 for(let i=layer.count;i<count;i++){const p=layer.order[i];layer.output[p]=layer.source[p]}
 layer.count=count;return true
}

function sceneSeconds(scene){return scene.duration/(scene.speed||1)}

// Recompute only when zoning replaces the stroke array.
const travelPlans=new WeakMap();
function strokeProgress(scene,fraction){
 if(!scene.lines.length)return {target:0};
 let plan=travelPlans.get(scene.lines);
 if(!plan){
  let end=0,previous=null;
  const segments=scene.lines.map(line=>{
   const first=line.points[0],gap=previous?Math.hypot(first[0]-previous[0],first[1]-previous[1]):0;
   const begin=end,draw=begin+gap;
   end=draw+line.points.length;
   const segment={begin,draw,end,previous,first,line};previous=line.points.at(-1);return segment
  });
  plan={segments,end};travelPlans.set(scene.lines,plan)
 }
 const distance=fraction*plan.end;
 let low=0,high=plan.segments.length-1;
 while(low<high){const middle=(low+high)>>1;if(distance>=plan.segments[middle].end)low=middle+1;else high=middle}
 const seg=plan.segments[low];
 if(distance<seg.draw){
  const t=(distance-seg.begin)/(seg.draw-seg.begin);
  return {target:seg.line.start,tip:seg.first.map((v,i)=>seg.previous[i]+(v-seg.previous[i])*t)}
 }
 return {target:Math.min(scene.length,seg.line.start+Math.floor(distance-seg.draw))}
}
