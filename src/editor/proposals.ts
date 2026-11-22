export interface InkComponent { id:number; area:number; left:number; top:number; right:number; bottom:number; x:number; y:number }
export function inkComponents(foreground:ArrayLike<number>,width:number,height:number){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>4_000_000||foreground.length!==width*height)throw Error('Invalid foreground dimensions.');
 const labels=new Uint32Array(width*height),queue=new Uint32Array(width*height),components:InkComponent[]=[];
 for(let start=0;start<labels.length;start++){
  if(!foreground[start]||labels[start])continue;
  const id=components.length+1;let head=0,tail=1,left=width,top=height,right=0,bottom=0,sx=0,sy=0;queue[0]=start;labels[start]=id;
  while(head<tail){const p=queue[head++],x=p%width,y=Math.floor(p/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);sx+=x;sy+=y;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const q=ny*width+nx;if(foreground[q]&&!labels[q]){labels[q]=id;queue[tail++]=q}}
  }
  components.push({id,area:tail,left,top,right,bottom,x:sx/tail,y:sy/tail});
 }
 const nearest=new Float64Array(components.length).fill(Infinity);
 for(let p=0;p<labels.length;p++)if(labels[p]){const c=components[labels[p]-1],x=p%width,y=Math.floor(p/width),distance=(x-c.x)**2+(y-c.y)**2;if(distance<nearest[c.id-1]){nearest[c.id-1]=distance;queue[c.id-1]=p}}
 for(const c of components){const p=queue[c.id-1];c.x=p%width;c.y=Math.floor(p/width)}
 return{labels,components};
}
export function proposalSeeds(foreground:ArrayLike<number>,width:number,height:number,budget=96){
 if(!Number.isInteger(budget)||budget<1||budget>256)throw Error('Invalid prompt budget.');
 const {components}=inkComponents(foreground,width,height),points:{x:number;y:number;kind:string}[]=[];
 const add=(x:number,y:number,kind:string)=>{if(points.length<budget&&!points.some(p=>(p.x-x)**2+(p.y-y)**2<16))points.push({x,y,kind})};
 // Retain sparse context prompts for outlined interiors, then target source ink that a grid can miss.
 for(let row=0;row<4;row++)for(let col=0;col<6;col++)add((col+.5)*width/6,(row+.5)*height/4,'context');
 for(const c of [...components].filter(c=>c.area>=6).sort((a,b)=>b.area-a.area)){add(c.x,c.y,'ink');if(c.area>150&&(c.right-c.left)>15&&(c.bottom-c.top)>15)add((c.left+c.right)/2,(c.top+c.bottom)/2,'interior')}
 return points;
}
export function boxInkMask(foreground:ArrayLike<number>,width:number,height:number,box:{left:number;top:number;right:number;bottom:number}){
 if(foreground.length!==width*height||!Object.values(box).every(Number.isFinite))throw Error('Invalid text selection.');
 const left=Math.max(0,Math.floor(Math.min(box.left,box.right))),right=Math.min(width-1,Math.ceil(Math.max(box.left,box.right))),top=Math.max(0,Math.floor(Math.min(box.top,box.bottom))),bottom=Math.min(height-1,Math.ceil(Math.max(box.top,box.bottom))),mask=new Uint8Array(width*height);
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const p=y*width+x;if(foreground[p])mask[p]=1}return mask;
}
export function maskRuns(mask:ArrayLike<number>){const runs:number[]=[];for(let p=0;p<mask.length;){if(!mask[p]){p++;continue}const start=p;while(p<mask.length&&mask[p])p++;runs.push(start,p-start)}return runs}
export function normalizedPrompts(points:{x:number;y:number;label:number}[],width:number,height:number,scale:number){
 if(!Array.isArray(points)||points.length<1||points.length>64||!Number.isFinite(scale)||scale<=0)throw Error('Invalid prompts.');
 const coords=new Float32Array(points.length*2),labels=new Float32Array(points.length);
 for(const [i,p]of points.entries()){if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||![ -1,0,1,2,3].includes(p.label))throw Error('Invalid prompt.');coords[i*2]=Math.max(0,Math.min(width,p.x))*scale;coords[i*2+1]=Math.max(0,Math.min(height,p.y))*scale;labels[i]=p.label}
 const boxes=points.filter(p=>p.label===2||p.label===3);if(boxes.length&&(boxes.length!==2||boxes[0].label!==2||boxes[1].label!==3))throw Error('Incomplete box prompt.');
 if(!points.some(p=>p.label===1)&&!boxes.length)throw Error('Select a foreground point or a box first.');
 return{coords,labels};
}
