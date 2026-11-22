import { buildTravelSegments } from '../engine-v2/reveal-scheduler.js';
import type { DrawingPlan, Point, StrokePath, TravelSegment } from '../engine-v2/types.js';
import type { SceneMetadata } from './project-store.js';
export interface PixelSchedule { readonly order: Uint32Array; readonly ends: Uint32Array; }
/** Structured-cloneable plan. No DOM nodes, UI state, clocks, callbacks or file handles. */
export interface ScenePlan {
  readonly schemaVersion: 1;
  readonly sceneId: string;
  readonly revision: number;
  readonly assetId: string;
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number;
  readonly holdFraction: number;
  readonly revealMode:'direct'|'outline-color';
  readonly mode: 'original' | 'ink' | 'color' | 'fill';
  readonly paper: string;
  readonly lineWidth: number;
  readonly transition: 'cut' | 'fade';
  readonly paths: readonly StrokePath[];
  readonly segments: readonly TravelSegment[];
  readonly totalDistance: number;
  readonly pointCount: number;
  readonly elementTiming:readonly {id:number;start:number;end:number;from:number;to:number}[]|null;
  readonly pixels: PixelSchedule | null;
  /** Compact component-to-element ranks. Labels alias the immutable drawing plan. */
  readonly elementOwnership:{readonly labels:Uint32Array;readonly ranks:Uint16Array}|null;
  readonly hand: { readonly enabled:boolean; readonly tone:number; readonly size:number; readonly side:number; readonly tip:Point };
}
export interface PenPose { readonly target:number; readonly tip:Point|null; readonly drawing:boolean; }
export function createScenePlan(metadata:SceneMetadata,drawing:DrawingPlan,pixels:PixelSchedule|null,handHint=false,handTip:Point=[5,88]):ScenePlan {
  if(drawing.width<=0||drawing.height<=0)throw new Error('Scene dimensions must be positive.');
  if(metadata.mode==='original'&&(!pixels||pixels.order.length!==drawing.width*drawing.height||![257,65537].includes(pixels.ends.length)))throw new Error('Scene pixel schedule is not ready.');
  const travel=buildTravelSegments(drawing.lines);
  const timed=(drawing.elements??[]).filter(element=>element.endDistance>element.startDistance),weighted=timed.some(element=>element.durationWeight!==undefined);
  let elapsed=0;const sum=timed.reduce((total,element)=>total+(element.durationWeight??1),0);
  const elementTiming=weighted?timed.map(element=>{const start=elapsed;elapsed+=(element.durationWeight??1)/sum;return {id:element.id,start,end:elapsed,from:Math.max(0,Math.min(1,element.startDistance/travel.totalDistance)),to:Math.max(0,Math.min(1,element.endDistance/travel.totalDistance))}}):null;
  if(elementTiming?.length)elementTiming[elementTiming.length-1].end=1;
  let elementOwnership:ScenePlan['elementOwnership']=null;
  if(elementTiming?.length){
    if(drawing.rasterLabels?.length!==drawing.width*drawing.height)throw new Error('Authored scene ownership is not ready.');
    if(elementTiming.length>=65535)throw new Error('Too many independently timed elements.');
    let maximumLabel=0;for(const component of drawing.components)maximumLabel=Math.max(maximumLabel,component.id);
    const ranks=new Uint16Array(maximumLabel+1),rankById=new Map(elementTiming.map((window,index)=>[window.id,index+1]));
    for(const element of timed)for(const componentId of element.componentIds)ranks[componentId]=rankById.get(element.id)??0;
    elementOwnership={labels:drawing.rasterLabels,ranks};
  }
  return Object.freeze({schemaVersion:1,sceneId:metadata.id,revision:metadata.revision,assetId:metadata.assetId,
    width:drawing.width,height:drawing.height,durationSeconds:metadata.duration/metadata.speed,holdFraction:metadata.hold/100,
    revealMode:metadata.mode==='original'&&metadata.revealMode==='outline-color'?'outline-color':'direct',mode:metadata.mode,paper:metadata.paper,lineWidth:metadata.weight,transition:metadata.transition,
    paths:drawing.lines,segments:travel.segments,totalDistance:travel.totalDistance,pointCount:drawing.length,elementTiming,elementOwnership,pixels,
    hand:Object.freeze({enabled:metadata.tone!==2&&metadata.sourceHand!=='present'&&(metadata.sourceHand!=='detect'||!handHint),tone:metadata.tone,size:metadata.handSize/100,side:Number(metadata.side),tip:[...handTip] as Point})});
}
export function createMotionPlan(lines:readonly StrokePath[],pointCount:number){const travel=buildTravelSegments(lines);return {segments:travel.segments,totalDistance:travel.totalDistance,pointCount}}
export function poseAt(plan:Pick<ScenePlan,'segments'|'totalDistance'|'pointCount'>,fraction:number):PenPose {
  if(!plan.segments.length)return {target:0,tip:null,drawing:false};
  const progress=Math.max(0,Math.min(1,Number.isFinite(fraction)?fraction:0));
  const travelled=progress*plan.totalDistance;
  let low=0,high=plan.segments.length-1;
  while(low<high){const mid=(low+high)>>1;if(travelled>=plan.segments[mid].end)low=mid+1;else high=mid}
  const segment=plan.segments[low],first=segment.line.points[0];
  if(travelled<segment.draw){
    const ratio=segment.draw>segment.begin?(travelled-segment.begin)/(segment.draw-segment.begin):1;
    const tip:Point=segment.previous?[segment.previous[0]+(first[0]-segment.previous[0])*ratio,segment.previous[1]+(first[1]-segment.previous[1])*ratio]:first;
    return {target:segment.line.start??0,tip,drawing:false};
  }
  if(progress===1)return {target:plan.pointCount,tip:segment.line.points.at(-1)??null,drawing:false};
  const along=Math.max(0,travelled-segment.draw),cumulative=segment.cumulative;
  let left=0,right=cumulative.length-1;
  while(left<right){const mid=Math.ceil((left+right)/2);if(cumulative[mid]>along)right=mid-1;else left=mid}
  const a=segment.line.points[left],b=segment.line.points[Math.min(left+1,cumulative.length-1)];
  const span=cumulative[left+1]===undefined?0:cumulative[left+1]-cumulative[left],ratio=span?Math.min(1,(along-cumulative[left])/span):0;
  return {target:Math.min(plan.pointCount,(segment.line.start??0)+left+ratio),tip:[a[0]+(b[0]-a[0])*ratio,a[1]+(b[1]-a[1])*ratio],drawing:true};
}
export class ScenePlanCompiler {
  private cache=new WeakMap<DrawingPlan,{revision:number;id:string;pixels:PixelSchedule|null;handTip:Point;plan:ScenePlan}>();
  compile(metadata:SceneMetadata,drawing:DrawingPlan,pixels:PixelSchedule|null,handHint=false,handTip:Point=[5,88]):ScenePlan {
    const cached=this.cache.get(drawing);
    if(cached&&cached.revision===metadata.revision&&cached.id===metadata.id&&cached.pixels===pixels&&cached.handTip[0]===handTip[0]&&cached.handTip[1]===handTip[1])return cached.plan;
    const plan=createScenePlan(metadata,drawing,pixels,handHint,handTip);
    this.cache.set(drawing,{revision:metadata.revision,id:metadata.id,pixels,handTip:[...handTip],plan});return plan;
  }
}

export interface ProjectPlan {
  readonly schemaVersion:1;
  readonly durationSeconds:number;
  readonly scenes:readonly {readonly start:number;readonly end:number;readonly plan:ScenePlan}[];
}
/** Plans own their immutable buffers. Creating a project snapshot never copies every raster buffer. */
export function createProjectPlan(plans:readonly ScenePlan[]):ProjectPlan {
  let start=0;
  const scenes=plans.map(plan=>{const entry=Object.freeze({start,end:start+plan.durationSeconds,plan});start=entry.end;return entry});
  return Object.freeze({schemaVersion:1,durationSeconds:start,scenes:Object.freeze(scenes)});
}
export function projectFrameAt(project:ProjectPlan,seconds:number):{index:number;local:number;plan:ScenePlan}|null {
  if(!project.scenes.length)return null;
  const time=Math.max(0,Math.min(project.durationSeconds,Number.isFinite(seconds)?seconds:0));
  let index=0;
  while(index<project.scenes.length-1&&time>=project.scenes[index].end)index++;
  const entry=project.scenes[index];return {index,local:time-entry.start,plan:entry.plan};
}

export function elementProgress(plan:ScenePlan,fraction:number):number{
 const windows=plan.elementTiming;if(!windows?.length)return fraction;if(fraction>=1)return 1;
 const window=windows.find(item=>fraction<item.end)??windows[windows.length-1];const local=Math.max(0,Math.min(1,(fraction-window.start)/(window.end-window.start)));return window.from+(window.to-window.from)*local;
}
