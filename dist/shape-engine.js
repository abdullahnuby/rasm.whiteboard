'use strict';
(function(root){
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 function simplifyPolyline(points,tolerance,paper){
  if(!Array.isArray(points)||points.length<3)return points||[];
  try{
   const Scope=paper?.PaperScope;
   if(typeof Scope==='function'){
    const scope=new Scope(),path=new scope.Path();
    for(const point of points)path.add(new scope.Point(point[0],point[1]));
    path.simplify(Math.max(.05,Number(tolerance)||.5));
    const result=path.segments.map(segment=>[segment.point.x,segment.point.y]);
    path.remove();
    if(result.length>=2)return result;
   }
  }catch{}
  return root.RasmImageEngine?.simplifyPolyline(points,tolerance)||points;
 }
 function boundsOfPoints(points){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const [x,y] of points){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}
  return Number.isFinite(minX)?{x:minX,y:minY,width:maxX-minX,height:maxY-minY,cx:(minX+maxX)/2,cy:(minY+maxY)/2}:{x:0,y:0,width:0,height:0,cx:0,cy:0};
 }
 function lineBounds(line){return line.bounds||boundsOfPoints(line.points||[])}
 function componentBoundsClose(a,b,gx,gy,componentA,componentB){
  const overlapX=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
  const overlapY=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  const gapX=Math.max(0,Math.max(a.x,b.x)-Math.min(a.x+a.width,b.x+b.width));
  const gapY=Math.max(0,Math.max(a.y,b.y)-Math.min(a.y+a.height,b.y+b.height));
  const ratioX=overlapX/Math.max(1,Math.min(a.width,b.width));
  const ratioY=overlapY/Math.max(1,Math.min(a.height,b.height));
  const small=componentA.area<=componentB.area?componentA:componentB;
  const large=small===componentA?componentB:componentA;
  const dot=small.area<=large.area*.22&&
   small.bounds.width<=Math.max(5,large.bounds.width*.72)&&
   small.bounds.height<=Math.max(5,large.bounds.height*.55);
  const alignedX=Math.abs(small.bounds.cx-large.bounds.cx)<=Math.max(6,large.bounds.width*.42);
  const closeVertically=gapY<=Math.max(6,large.bounds.height*.48);
  const closeHorizontally=gapX<=Math.max(4,large.bounds.width*.32);
  if(dot&&alignedX&&closeVertically&&closeHorizontally)return true;
  // Equal-size neighbouring objects stay separate unless their raster masks
  // almost touch and their projections strongly overlap.
  return (gapX<=gx&&ratioY>=.38)||(gapY<=gy&&ratioX>=.38);
 }
 function connectedComponentsFallback(mask,width,height){
  const size=width*height,labels=new Int32Array(size),queue=new Int32Array(size),components=[];
  let next=0;
  for(let p=0;p<size;p++){
   if(!mask[p]||labels[p])continue;
   const id=++next;let head=0,tail=0,minX=width,minY=height,maxX=0,maxY=0,area=0;
   labels[p]=id;queue[tail++]=p;
   while(head<tail){
    const q=queue[head++],x=q%width,y=(q/width)|0;area++;
    if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;
     if(nx<0||nx>=width||ny<0||ny>=height)continue;
     const n=ny*width+nx;if(mask[n]&&!labels[n]){labels[n]=id;queue[tail++]=n}
    }
   }
   if(area>=3)components.push({label:id,area,bounds:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1,cx:(minX+maxX)/2,cy:(minY+maxY)/2}});
   else for(let i=0;i<tail;i++)labels[queue[i]]=0;
  }
  return {labels,components,backend:'builtin-components'};
 }
 function connectedComponentsOpenCv(mask,width,height,cv){
  if(!cv?.Mat||!cv?.connectedComponentsWithStats||!cv?.morphologyEx)return null;
  let src=null,closed=null,kernel=null,labelsMat=null,stats=null,centroids=null;
  try{
   src=new cv.Mat(height,width,cv.CV_8UC1);src.data.set(mask);
   closed=new cv.Mat();
   const kw=3,kh=3; // bridge only antialiasing cracks; do not fuse neighbouring elements
   kernel=cv.getStructuringElement(cv.MORPH_ELLIPSE,new cv.Size(kw,kh));
   cv.morphologyEx(src,closed,cv.MORPH_CLOSE,kernel);
   labelsMat=new cv.Mat();stats=new cv.Mat();centroids=new cv.Mat();
   const count=cv.connectedComponentsWithStats(closed,labelsMat,stats,centroids,8,cv.CV_32S);
   const raw=labelsMat.data32S.slice(),components=[];
   for(let label=1;label<count;label++){
    const offset=label*5,area=stats.data32S[offset+cv.CC_STAT_AREA];
    if(area<3)continue;
    const x=stats.data32S[offset+cv.CC_STAT_LEFT],y=stats.data32S[offset+cv.CC_STAT_TOP];
    const w=stats.data32S[offset+cv.CC_STAT_WIDTH],h=stats.data32S[offset+cv.CC_STAT_HEIGHT];
    components.push({label,area,bounds:{x,y,width:w,height:h,cx:x+w/2,cy:y+h/2}});
   }
   return {labels:raw,components,backend:'opencv-5',kernel:{width:kw,height:kh}};
  }catch{return null}
  finally{for(const item of [src,closed,kernel,labelsMat,stats,centroids])try{item?.delete?.()}catch{}}
 }
 function mergeComponents(components,width,height,scale=1){
  if(!components.length)return {groups:[],labelToGroup:new Map()};
  const parent=components.map((_,i)=>i),find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x]}return x};
  const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a};
  const gx=clamp(Math.round(width*.005*scale),2,7),gy=clamp(Math.round(height*.006*scale),2,6);
  const sorted=components.map((component,index)=>({component,index})).sort((a,b)=>a.component.bounds.x-b.component.bounds.x);
  for(let i=0;i<sorted.length;i++){
   const a=sorted[i].component.bounds;
   for(let j=i+1;j<sorted.length;j++){
    const b=sorted[j].component.bounds;
    if(b.x>a.x+a.width+gx)break;
    if(componentBoundsClose(a,b,gx,gy,sorted[i].component,sorted[j].component))join(sorted[i].index,sorted[j].index);
   }
  }
  const map=new Map();
  components.forEach((component,index)=>{
   const rootId=find(index);if(!map.has(rootId))map.set(rootId,[]);
   map.get(rootId).push(component)
  });
  const groups=[...map.values()].map(items=>{
   const minX=Math.min(...items.map(x=>x.bounds.x)),minY=Math.min(...items.map(x=>x.bounds.y));
   const maxX=Math.max(...items.map(x=>x.bounds.x+x.bounds.width)),maxY=Math.max(...items.map(x=>x.bounds.y+x.bounds.height));
   return {componentLabels:items.map(x=>x.label),area:items.reduce((s,x)=>s+x.area,0),
    bounds:{x:minX,y:minY,width:maxX-minX,height:maxY-minY,cx:(minX+maxX)/2,cy:(minY+maxY)/2}};
  });
  // Reading rows are grouped by vertical proximity; each row is read right-to-left.
  groups.sort((a,b)=>a.bounds.cy-b.bounds.cy);
  const rows=[];
  for(const group of groups){
   const b=group.bounds,threshold=Math.max(8,Math.min(34,Math.max(12,b.height)*.62));
   let row=rows.find(candidate=>Math.abs(candidate.cy-b.cy)<=Math.max(threshold,candidate.height*.55));
   if(!row){row={cy:b.cy,height:b.height,groups:[]};rows.push(row)}
   row.groups.push(group);row.cy=(row.cy*(row.groups.length-1)+b.cy)/row.groups.length;row.height=Math.max(row.height,b.height);
  }
  rows.sort((a,b)=>a.cy-b.cy);
  const ordered=rows.flatMap(row=>row.groups.sort((a,b)=>b.bounds.cx-a.bounds.cx));
  ordered.forEach((group,index)=>{group.rasterLabels=[index+1];group.id=index+1});
  const labelToGroup=new Map();ordered.forEach((group,index)=>group.componentLabels.forEach(label=>labelToGroup.set(label,index+1)));
  return {groups:ordered,labelToGroup};
 }
 function labelNear(labels,width,height,x,y,radius=3){
  const ix=clamp(Math.round(x),0,width-1),iy=clamp(Math.round(y),0,height-1);
  const direct=labels[iy*width+ix];if(direct)return direct;
  let best=0,bestDistance=Infinity;
  for(let r=1;r<=radius;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
   if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
   const nx=ix+dx,ny=iy+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;
   const label=labels[ny*width+nx];if(!label)continue;
   const d=dx*dx+dy*dy;if(d<bestDistance){best=label;bestDistance=d}
  }
  return best;
 }
 function groupPaths(lines,componentGroups,labels,labelToGroup,width,height,source){
  const groups=componentGroups.map((group,index)=>({...group,id:index+1,rasterLabels:[index+1],lineIndices:[],source}));
  const unmatched=[];
  lines.forEach((line,index)=>{
   const points=line.points||[];if(!points.length){unmatched.push(index);return}
   const votes=new Map(),stride=Math.max(1,Math.floor(points.length/36));
   for(let p=0;p<points.length;p+=stride){
    const point=points[p],label=labelNear(labels,width,height,point[0],point[1],3);
    const groupId=labelToGroup.get(label);if(groupId)votes.set(groupId,(votes.get(groupId)||0)+1);
   }
   let chosen=0,voteCount=0;
   for(const [id,count] of votes)if(count>voteCount){chosen=id;voteCount=count}
   if(!chosen){
    const bounds=lineBounds(line);let best=Infinity;
    for(const group of groups){
     const b=group.bounds,dx=Math.max(0,b.x-bounds.cx,bounds.cx-(b.x+b.width)),dy=Math.max(0,b.y-bounds.cy,bounds.cy-(b.y+b.height));
     const d=Math.hypot(dx,dy);if(d<best){best=d;chosen=group.id}
    }
    if(best>Math.max(12,Math.min(width,height)*.035))chosen=0;
   }
   if(chosen)groups[chosen-1].lineIndices.push(index);else unmatched.push(index);
  });
  // Paths that are not inside a thresholded region are clustered by proximity.
  const orphan=[];
  for(const index of unmatched){
   const b=lineBounds(lines[index]);let target=null,best=Infinity;
   for(const group of orphan){
    const q=group.bounds,dx=Math.max(0,q.x-(b.x+b.width),b.x-(q.x+q.width)),dy=Math.max(0,q.y-(b.y+b.height),b.y-(q.y+q.height));
    const d=Math.hypot(dx,dy);if(d<best){best=d;target=group}
   }
   const limit=Math.max(4,Math.min(9,Math.min(width,height)*.012));
   if(target&&best<=limit){
    target.lineIndices.push(index);
    const q=target.bounds,minX=Math.min(q.x,b.x),minY=Math.min(q.y,b.y),maxX=Math.max(q.x+q.width,b.x+b.width),maxY=Math.max(q.y+q.height,b.y+b.height);
    target.bounds={x:minX,y:minY,width:maxX-minX,height:maxY-minY,cx:(minX+maxX)/2,cy:(minY+maxY)/2};
   }else orphan.push({id:groups.length+orphan.length+1,lineIndices:[index],bounds:{...b},area:0,componentLabels:[],rasterLabels:[],source:'path-cluster'});
  }
  orphan.sort((a,b)=>a.bounds.cy-b.bounds.cy||b.bounds.cx-a.bounds.cx);
  for(const group of orphan){group.id=groups.length+1;groups.push(group)}
  return groups.filter(group=>group.lineIndices.length||group.area>0);
 }
 function analyze(mask,width,height,centerLines,contourLines,cv,options={}){
  if(!mask||mask.length!==width*height)mask=new Uint8Array(width*height);
  let components=connectedComponentsOpenCv(mask,width,height,cv);
  if(!components)components=connectedComponentsFallback(mask,width,height);
  const merged=mergeComponents(components.components,width,height,options.mergeScale||1);
  const labels=new Uint16Array(width*height);
  for(let p=0;p<labels.length;p++){
   const old=components.labels[p];if(old)labels[p]=merged.labelToGroup.get(old)||0;
  }
  const centerGroups=groupPaths(centerLines||[],merged.groups,components.labels,merged.labelToGroup,width,height,'centerline');
  const contourGroups=groupPaths(contourLines||[],merged.groups,components.labels,merged.labelToGroup,width,height,'contour');
  return {
   rasterLabels:labels,
   centerGroups,contourGroups,
   metrics:{
    backend:components.backend,components:components.components.length,
    shapes:merged.groups.length,centerPaths:(centerLines||[]).length,
    contourPaths:(contourLines||[]).length,
    groupedCenterPaths:centerGroups.reduce((s,g)=>s+g.lineIndices.length,0),
    groupedContourPaths:contourGroups.reduce((s,g)=>s+g.lineIndices.length,0),
    kernel:components.kernel||null
   }
  };
 }
 root.RasmShapeEngine=Object.freeze({
  analyze,simplifyPolyline,connectedComponentsFallback,mergeComponents,groupPaths,boundsOfPoints
 });
})(typeof self!=='undefined'?self:(typeof window!=='undefined'?window:globalThis));
