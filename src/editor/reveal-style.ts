import {buildForegroundMask} from '../engine-v2/segmentation.js';
import type {ScenePlan} from './scene-plan.js';
import {elementProgress} from './scene-plan.js';

// A small separable local threshold, not a semantic model. It keeps thin source
// strokes solid while leaving the interior of large flat color areas unfilled.
// Source RGB is never edited. The derived mask is used only during the sketch pass.
const radius=7;
const gaussian=Float64Array.from({length:radius*2+1},(_,i)=>Math.exp(-((i-radius)**2)/(2*2.6**2)));
const gaussianSum=gaussian.reduce((sum,value)=>sum+value,0);
for(let i=0;i<gaussian.length;i++)gaussian[i]/=gaussianSum;

export function createOutlineMask(pixels:Uint8ClampedArray,width:number,height:number):Uint8Array {
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||pixels.length!==width*height*4)throw Error('Invalid outline source.');
 const foreground=buildForegroundMask(pixels,width,height).mask,gray=new Uint8Array(width*height),horizontal=new Float32Array(gray.length),mask=new Uint8Array(gray.length);
 for(let p=0;p<gray.length;p++)gray[p]=Math.round(pixels[p*4]*.299+pixels[p*4+1]*.587+pixels[p*4+2]*.114);
 const row=new Float32Array(width+radius*2);
 for(let y=0;y<height;y++){
  const at=y*width;
  for(let x=0;x<row.length;x++)row[x]=gray[at+Math.max(0,Math.min(width-1,x-radius))];
  for(let x=0;x<width;x++){let mean=0;for(let k=0;k<gaussian.length;k++)mean+=row[x+k]*gaussian[k];horizontal[at+x]=mean}
 }
 const column=new Float32Array(height+radius*2);
 for(let x=0;x<width;x++){
  for(let y=0;y<column.length;y++)column[y]=horizontal[Math.max(0,Math.min(height-1,y-radius))*width+x];
  for(let y=0;y<height;y++){
   const p=y*width+x;if(!foreground[p])continue;
   let mean=0;for(let k=0;k<gaussian.length;k++)mean+=column[y+k]*gaussian[k];
   if(gray[p]<=Math.round(mean)-10)mask[p]=1;
  }
 }
 return mask;
}

export interface RevealPhase {progress:number;outline:number;color:number;transfer?:{from:number;to:number;ratio:number};}
/** Each accepted element finishes its outline and color before the next one starts. */
export function revealPhaseAt(plan:ScenePlan,fraction:number):RevealPhase {
 const clamped=Math.max(0,Math.min(1,fraction));
 if(plan.revealMode!=='outline-color'){const progress=elementProgress(plan,clamped);return {progress,outline:progress,color:progress}}
 if(clamped>=1)return {progress:1,outline:1,color:1};
 const window=plan.elementTiming?.find(w=>clamped<w.end)??{id:undefined,start:0,end:1,from:0,to:1};
 const local=(clamped-window.start)/(window.end-window.start),span=window.to-window.from;
 if(local<.6){const progress=window.from+span*local/.6;return {progress,outline:progress,color:window.from}}
 const fill=(local-.6)/.4,first=plan.segments.find(segment=>window.id===undefined||segment.elementId===window.id);
 const fillFrom=Math.min(window.to,Math.max(window.from,(first?.draw??window.from*plan.totalDistance)/plan.totalDistance));
 if(fill<.08){const t=Math.max(0,fill/.08);return {progress:fillFrom,outline:window.to,color:window.from,transfer:{from:window.to,to:fillFrom,ratio:t*t*(3-2*t)}}}
 const progress=fillFrom+(window.to-fillFrom)*(fill-.08)/.92;
 return {progress,outline:window.to,color:progress};
}
