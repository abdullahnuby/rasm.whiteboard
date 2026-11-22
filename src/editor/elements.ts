import type {RasterAnalysis,RasterElement,ComponentRecord,Rect} from '../engine-v2/types.js';
export interface ElementItem {readonly id:string;readonly key:number;readonly name:string;readonly duration:number;}
export interface ElementSnapshot {readonly version:1;readonly width:number;readonly height:number;readonly revision:number;readonly nextKey:number;readonly items:readonly ElementItem[];readonly owners:Uint16Array;}
type State={version:1;width:number;height:number;revision:number;nextKey:number;items:ElementItem[];owners:Uint16Array};
const clone=(s:ElementSnapshot):State=>({...s,items:s.items.map(i=>({...i})),owners:s.owners.slice()});
/** Source pixels never change. Zero means unassigned ink, not deleted ink. */
export class ElementDocument {
 private current:State;private past:State[]=[];private future:State[]=[];private foreground:Uint8Array;private nextIdentity=1;private serial=0;
 constructor(width:number,height:number,labels:Uint32Array,saved?:ElementSnapshot){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||labels.length!==width*height)throw Error('Invalid element canvas.');
  this.foreground=Uint8Array.from(labels,v=>v?1:0);
  this.current=saved?clone(saved):{version:1,width,height,revision:0,nextKey:1,items:[],owners:new Uint16Array(width*height)};
  if(this.current.width!==width||this.current.height!==height)throw Error('Element canvas does not match source.');this.validate(this.current);this.nextIdentity=this.current.nextKey;this.serial=this.current.revision;
 }
 private validate(s:State){
  if(!Number.isInteger(s.revision)||s.revision<0||s.version!==1||s.owners.length!==this.foreground.length||s.items.length>200||!Number.isInteger(s.nextKey)||s.nextKey<1||s.nextKey>65535)throw Error('Invalid element document.');
  const ids=new Set<string>(),keys=new Set<number>();
  for(const item of s.items){if(!item.id||ids.has(item.id)||!Number.isInteger(item.key)||item.key<1||item.key>=s.nextKey||keys.has(item.key)||typeof item.name!=='string'||item.name.length>120||!Number.isFinite(item.duration)||item.duration<=0||item.duration>1_000_000)throw Error('Invalid element metadata.');ids.add(item.id);keys.add(item.key)}
  for(let p=0;p<s.owners.length;p++)if(s.owners[p]&&(!this.foreground[p]||!keys.has(s.owners[p])))throw Error('Invalid element pixel ownership.');
 }
 get snapshot():ElementSnapshot{return clone(this.current)}
 get canUndo(){return this.past.length>0}get canRedo(){return this.future.length>0}
 private edit(action:(next:State)=>void){const next=clone(this.current);action(next);next.revision=this.serial+1;this.validate(next);this.serial=next.revision;this.nextIdentity=Math.max(this.nextIdentity,next.nextKey);this.past.push(this.current);if(this.past.length>10)this.past.shift();this.future=[];this.current=next}
 undo(){const previous=this.past.pop();if(previous){this.future.push(this.current);this.current={...previous,nextKey:this.nextIdentity,revision:++this.serial}}}
 redo(){const next=this.future.pop();if(next){this.past.push(this.current);this.current={...next,nextKey:this.nextIdentity,revision:++this.serial}}}
 private item(s:State,id:string){const item=s.items.find(i=>i.id===id);if(!item)throw Error('Element no longer exists.');return item}
 private checkMask(mask:Uint8Array){if(mask.length!==this.foreground.length)throw Error('Mask dimensions do not match source.')}
 add(mask:Uint8Array,name='عنصر جديد',replace=false):string{
  this.checkMask(mask);let id='';this.edit(s=>{if(s.nextKey>=65535)throw Error('Element identity limit reached.');const key=s.nextKey++;id='element-'+key;let count=0;
   for(let p=0;p<mask.length;p++)if(mask[p]&&this.foreground[p]&&(replace||!s.owners[p])){s.owners[p]=key;count++}
   if(!count)throw Error('لا توجد مساحة جديدة لهذا العنصر. قد يكون مغطى بعنصر سبق اعتماده.');s.items.push({id,key,name:name.slice(0,120),duration:1})});return id;
 }
 rename(id:string,name:string){this.edit(s=>{const item=this.item(s,id);s.items[s.items.indexOf(item)]={...item,name:name.trim().slice(0,120)||'عنصر'}})}
 setDuration(id:string,duration:number){this.edit(s=>{const item=this.item(s,id);s.items[s.items.indexOf(item)]={...item,duration}})}
 move(id:string,delta:number){if(!Number.isInteger(delta))throw Error('Invalid element movement.');this.edit(s=>{const item=this.item(s,id),index=s.items.indexOf(item),to=Math.max(0,Math.min(s.items.length-1,index+delta));s.items.splice(index,1);s.items.splice(to,0,item)})}
 remove(id:string){this.edit(s=>{const item=this.item(s,id);s.items=s.items.filter(i=>i!==item);for(let p=0;p<s.owners.length;p++)if(s.owners[p]===item.key)s.owners[p]=0})}
 merge(ids:readonly string[]):string{if(ids.length<2||new Set(ids).size!==ids.length)throw Error('Select at least two different elements.');let target='';this.edit(s=>{const chosen=ids.map(id=>this.item(s,id)),keep=chosen[0],keys=new Set(chosen.map(i=>i.key));target=keep.id;s.items=s.items.map(i=>i===keep?{...i,duration:chosen.reduce((sum,item)=>sum+item.duration,0)}:i);s.items=s.items.filter(i=>i.id===keep.id||!keys.has(i.key));for(let p=0;p<s.owners.length;p++)if(keys.has(s.owners[p]))s.owners[p]=keep.key});return target}
 split(id:string,mask:Uint8Array):string{this.checkMask(mask);let created='';this.edit(s=>{const old=this.item(s,id);let selected=0,remaining=0;for(let p=0;p<mask.length;p++)if(s.owners[p]===old.key){if(mask[p])selected++;else remaining++}if(!selected||!remaining)throw Error('حدّد جزءًا من العنصر، وليس العنصر كله.');const key=s.nextKey++;created='element-'+key;const index=s.items.indexOf(old),fraction=selected/(selected+remaining);s.items[index]={...old,duration:old.duration*(1-fraction)};s.items.splice(index+1,0,{id:created,key,name:(old.name+' · جزء').slice(0,120),duration:old.duration*fraction});for(let p=0;p<mask.length;p++)if(mask[p]&&s.owners[p]===old.key)s.owners[p]=key});return created}
 paint(id:string,mask:Uint8Array,mode:'add'|'remove'){this.checkMask(mask);this.edit(s=>{const key=this.item(s,id).key;for(let p=0;p<mask.length;p++)if(mask[p]&&this.foreground[p]){if(mode==='add')s.owners[p]=key;else if(s.owners[p]===key)s.owners[p]=0}})}
 counts(){let assigned=0,unassigned=0;const pixels=new Map<number,number>();for(let p=0;p<this.foreground.length;p++)if(this.foreground[p]){const key=this.current.owners[p];if(key){assigned++;pixels.set(key,(pixels.get(key)||0)+1)}else unassigned++}return {assigned,unassigned,pixels}}
}
/** Rebuild connected routing components from accepted semantic masks, retaining all unassigned ink. */
export function elementAnalysis(base:RasterAnalysis,snapshot:ElementSnapshot):RasterAnalysis {
 const document=new ElementDocument(base.width,base.height,base.rasterLabels,snapshot),s=document.snapshot,{width,height}=base,size=width*height;
 const labels=new Uint32Array(size),queue=new Uint32Array(size),components:ComponentRecord[]=[],groups=new Map<number,RasterElement>(),ranks=new Map(s.items.map((item,index)=>[item.key,index]));const remainder=s.nextKey;
 let next=0;
 for(let seed=0;seed<size;seed++){
  if(!base.rasterLabels[seed]||labels[seed])continue;const owner=s.owners[seed],id=++next;let head=0,tail=1;queue[0]=seed;labels[seed]=id;let left=seed%width,right=left,top=(seed/width)|0,bottom=top;
  while(head<tail){const p=queue[head++],x=p%width,y=(p/width)|0;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const q=ny*width+nx;if(!labels[q]&&base.rasterLabels[q]&&s.owners[q]===owner){labels[q]=id;queue[tail++]=q}}
  }
  const bounds:Rect={x:left,y:top,width:right-left+1,height:bottom-top+1,cx:(left+right)/2,cy:(top+bottom)/2};components.push({id,area:tail,bounds});
  const key=owner||remainder,old=groups.get(key);
  if(old){old.componentIds.push(id);old.area+=tail;const x=Math.min(old.bounds.x,left),y=Math.min(old.bounds.y,top),r=Math.max(old.bounds.x+old.bounds.width,right+1),b=Math.max(old.bounds.y+old.bounds.height,bottom+1);old.bounds={x,y,width:r-x,height:b-y,cx:(x+r)/2,cy:(y+b)/2}}
  else groups.set(key,{id:key,area:tail,bounds,componentIds:[id],orderIndex:ranks.get(owner)??s.items.length,durationWeight:s.items.find(item=>item.key===owner)?.duration??1});
 }
 const elements=[...groups.values()].sort((a,b)=>a.orderIndex-b.orderIndex);
 return {...base,rasterLabels:labels,components,elements,authorOrder:true,unassignedElementId:remainder,diagnostics:{...base.diagnostics,componentCount:components.length,elementCount:elements.length,warnings:[...base.diagnostics.warnings,'Accepted element masks control routing order; unassigned source ink is retained last.']}};
}
export function encodeOwnership(snapshot:ElementSnapshot):Blob{const bytes=new Uint8Array(snapshot.owners.length*2),view=new DataView(bytes.buffer);for(let i=0;i<snapshot.owners.length;i++)view.setUint16(i*2,snapshot.owners[i],true);return new Blob([bytes],{type:'application/x-rasm-owners'})}
export async function decodeOwnership(metadata:Omit<ElementSnapshot,'owners'>,blob:Blob):Promise<ElementSnapshot>{const buffer=await blob.arrayBuffer();if(buffer.byteLength!==metadata.width*metadata.height*2)throw Error('Invalid element ownership asset.');const view=new DataView(buffer),owners=new Uint16Array(metadata.width*metadata.height);for(let i=0;i<owners.length;i++)owners[i]=view.getUint16(i*2,true);return {...metadata,owners}}
export function decodeMaskRuns(runs:readonly number[],width:number,height:number,targetWidth=width,targetHeight=height):Uint8Array{
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>16_000_000||runs.length%2||runs.length>8_000_000)throw Error('Invalid mask runs.');const mask=new Uint8Array(width*height);let end=0;
 for(let i=0;i<runs.length;i+=2){const start=runs[i],length=runs[i+1];if(!Number.isInteger(start)||!Number.isInteger(length)||start<end||length<1||start+length>mask.length)throw Error('Invalid mask range.');mask.fill(1,start,start+length);end=start+length}
 if(width===targetWidth&&height===targetHeight)return mask;const result=new Uint8Array(targetWidth*targetHeight);for(let y=0;y<targetHeight;y++)for(let x=0;x<targetWidth;x++)result[y*targetWidth+x]=mask[Math.min(height-1,Math.floor((y+.5)*height/targetHeight))*width+Math.min(width-1,Math.floor((x+.5)*width/targetWidth))];return result;
}
