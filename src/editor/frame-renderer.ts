import type { Point } from '../engine-v2/types.js';
import {revealPhaseAt} from './reveal-style.js';
import { poseAt, projectFrameAt, type ScenePlan } from './scene-plan.js';
export type DrawingContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export interface ImageResource { readonly image:CanvasImageSource; readonly width:number; readonly height:number; }
export interface FrameTarget {
  readonly context:DrawingContext;
  readonly width:number;
  readonly height:number;
  readonly source:ImageResource;
  readonly sourcePixels:Uint8ClampedArray;
  readonly outlineMask?:Uint8Array;
  readonly scratch: { readonly image:CanvasImageSource; readonly context:DrawingContext; readonly pixels:ImageData };
  readonly hands: { readonly photo?:ImageResource; readonly custom?:ImageResource };
}
function pointAt(points:readonly Point[],position:number):Point {
  const p=Math.max(0,Math.min(points.length-1,position)),i=Math.floor(p),f=p-i,a=points[i],b=points[Math.min(points.length-1,i+1)];
  return f?[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]:a;
}
function drawPath(context:DrawingContext,points:readonly Point[],end:number,color:string,width:number):void {
  if(points.length<2||end<=0)return;
  context.beginPath();context.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<end&&i<points.length;i++)context.lineTo(points[i][0],points[i][1]);
  const last=pointAt(points,end);context.lineTo(last[0],last[1]);
  context.strokeStyle=color;context.lineWidth=width;context.lineJoin=context.lineCap='round';context.stroke();
}
function drawVectorHand(c:DrawingContext,x:number,y:number,scale:number,tone:number,side:number):void {
  const skin=tone===1?'#986642':'#e6af89';
  c.save();c.translate(x,y);c.scale(scale*side,scale);c.rotate(-.12);
  c.fillStyle='#273c31';c.beginPath();c.moveTo(0,0);c.lineTo(4,-10);c.lineTo(42,-46);c.quadraticCurveTo(46,-48,49,-42);c.lineTo(9,-5);c.closePath();c.fill();
  c.fillStyle=skin;c.strokeStyle='#765544';c.lineWidth=1.4;c.beginPath();c.moveTo(22,-18);c.bezierCurveTo(15,-20,10,-15,13,-11);c.quadraticCurveTo(19,-7,31,-13);c.quadraticCurveTo(25,-5,31,0);c.quadraticCurveTo(40,9,54,13);c.lineTo(79,34);c.lineTo(99,11);c.lineTo(74,-7);c.quadraticCurveTo(64,-23,52,-31);c.quadraticCurveTo(43,-37,36,-32);c.lineTo(20,-23);c.quadraticCurveTo(15,-16,22,-18);c.fill();c.stroke();
  drawPath(c,[[22,-18],[35,-22],[42,-18]],2,'#906c53',1.4);drawPath(c,[[32,-13],[41,-16],[48,-12]],2,'#906c53',1.4);c.restore();
}
function drawHand(plan:ScenePlan,target:FrameTarget,x:number,y:number):void {
  if(!plan.hand.enabled)return;
  const c=target.context,scale=Math.min(target.width,target.height)/425*plan.hand.size;
  const image=plan.hand.tone===4?target.hands.photo:plan.hand.tone===3?target.hands.custom:undefined;
  if(plan.hand.tone===3||plan.hand.tone===4){
    if(!image||!image.width||!image.height)return;
    const width=scale*(plan.hand.tone===4?190:112),height=width*image.height/image.width;
    const tip=plan.hand.tone===4?[.052,.15]:[plan.hand.tip[0]/100,plan.hand.tip[1]/100];
    c.save();c.translate(x,y);c.scale(plan.hand.side,1);c.drawImage(image.image,-width*tip[0],-height*tip[1],width,height);c.restore();
  }else drawVectorHand(c,x,y,scale,plan.hand.tone,plan.hand.side);
}
/** Deterministic frame renderer. Its entire input is the plan, timestamp and explicit image/target resources.
 * No globals, DOM access, mutable editor state, wall clock, async job or previous-frame dependency.
 * Rendering the same timestamp after scrubbing backwards produces the same pixels.
 */
export function renderFrame(plan:ScenePlan,seconds:number,target:FrameTarget):void {
  const c=target.context,{width:W,height:H}=target;
  if(target.source.width!==plan.width||target.source.height!==plan.height)throw new Error('Source image does not match the scene plan.');
  const local=Math.max(0,Math.min(plan.durationSeconds,Number.isFinite(seconds)?seconds:0));
  const drawTime=plan.durationSeconds*(1-plan.holdFraction),timeFraction=Math.min(1,local/drawTime),phase=revealPhaseAt(plan,timeFraction),fraction=phase.progress;
  let pose=poseAt(plan,fraction);
  if(phase.transfer){const a=poseAt(plan,phase.transfer.from).tip,b=poseAt(plan,phase.transfer.to).tip;if(a&&b)pose={...pose,drawing:false,tip:[a[0]+(b[0]-a[0])*phase.transfer.ratio,a[1]+(b[1]-a[1])*phase.transfer.ratio]}}
  const layer=target.scratch.context;
  layer.save();layer.setTransform(1,0,0,1,0,0);layer.clearRect(0,0,plan.width,plan.height);
  if(plan.mode==='original'){
    const schedule=plan.pixels;
    if(!schedule)throw new Error('Pixel reveal schedule is not ready.');
    if(target.sourcePixels.length!==plan.width*plan.height*4)throw new Error('Invalid source pixel buffer.');
    const output=new Uint32Array(target.scratch.pixels.data.buffer),source=new Uint32Array(target.sourcePixels.buffer,target.sourcePixels.byteOffset,target.sourcePixels.byteLength/4);
    output.fill(0);
    const resolution=schedule.ends.length-1;
    const countAt=(progress:number)=>schedule.ends[Math.min(resolution,Math.max(0,Math.floor(resolution*progress)))];
    const ownership=plan.elementOwnership,windows=plan.elementTiming;
    if(ownership&&windows?.length){
      if(ownership.labels.length!==plan.width*plan.height)throw Error('Authored pixel ownership does not match the scene.');
      const activeIndex=timeFraction>=1?windows.length:windows.findIndex(window=>timeFraction<window.end),activeRank=activeIndex+1;
      const outlineColor=plan.revealMode==='outline-color',outlineCount=countAt(phase.outline),colorCount=countAt(phase.color);
      if(outlineColor&&target.outlineMask?.length!==plan.width*plan.height)throw Error('Outline resources are not ready.');
      const fullyOutlined=outlineColor&&activeIndex<windows.length&&phase.outline>=windows[activeIndex].to;
      const currentColorStarted=!outlineColor||activeIndex>=windows.length||phase.color>windows[activeIndex].from;
      const black=new Uint32Array(new Uint8Array([32,32,32,255]).buffer)[0];
      // Quantized timestamps can straddle an authored element boundary. Pixel
      // ownership, not a rounded global bin, is the final authority there.
      // Earlier elements are complete; later ones cannot appear prematurely.
      for(let i=0;i<schedule.order.length;i++){
        const pixel=schedule.order[i],rank=ownership.ranks[ownership.labels[pixel]]??0;
        // Nominal background can contain faint JPEG halos of later objects.
        // Do not leak those through the first element's color pass. The exact
        // background bytes return with the completed source frame.
        if(rank===0&&timeFraction<1)continue;
        if(rank>0&&rank<activeRank){output[pixel]=source[pixel];continue}
        if(rank>activeRank)continue;
        if(i<colorCount&&(rank===0||currentColorStarted))output[pixel]=source[pixel];
        else if(outlineColor&&target.outlineMask![pixel]&&(i<outlineCount||(rank===activeRank&&fullyOutlined)))output[pixel]=black;
      }
    }else if(plan.revealMode==='outline-color'){
      if(target.outlineMask?.length!==plan.width*plan.height)throw Error('Outline resources are not ready.');
      const outlineCount=countAt(phase.outline),colorCount=countAt(phase.color),black=new Uint32Array(new Uint8Array([32,32,32,255]).buffer)[0];
      for(let i=0;i<Math.max(outlineCount,colorCount);i++){const pixel=schedule.order[i];if(i<colorCount)output[pixel]=source[pixel];else if(target.outlineMask[pixel])output[pixel]=black}
    }else{const count=countAt(fraction);for(let i=0;i<count;i++){const pixel=schedule.order[i];output[pixel]=source[pixel]}}
    layer.putImageData(target.scratch.pixels,0,0);
  }else{
    for(const path of plan.paths){
      const begin=path.start??0;if(pose.target<=begin)break;
      drawPath(layer,path.points,Math.min(path.points.length-1,pose.target-begin),plan.mode==='color'?(path.color??'#29362e'):'#29362e',plan.lineWidth);
    }
  }
  layer.restore();
  const scale=Math.min(W/plan.width,H/plan.height)*.96,ox=(W-scale*plan.width)/2,oy=(H-scale*plan.height)/2;
  c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.fillStyle=plan.paper;c.fillRect(0,0,W,H);
  c.save();c.translate(ox,oy);c.scale(scale,scale);c.drawImage(target.scratch.image,0,0);
  if(plan.mode==='fill'&&fraction===1){c.globalAlpha=plan.holdFraction===0?1:Math.min(1,(local-drawTime)/Math.min(.6,plan.durationSeconds*plan.holdFraction));c.drawImage(target.source.image,0,0);c.globalAlpha=1}
  c.restore();
  if(pose.tip&&(timeFraction<1||plan.mode!=='original'))drawHand(plan,target,ox+pose.tip[0]*scale,oy+pose.tip[1]*scale);
  if(plan.transition==='fade'){
    c.globalAlpha=Math.max(0,1-(plan.durationSeconds-local)/Math.min(.45,plan.durationSeconds*.22));c.fillStyle=plan.paper;c.fillRect(0,0,W,H);
  }
  c.restore();
}

export function renderProjectFrame(project:import('./scene-plan.js').ProjectPlan,seconds:number,targetFor:(plan:ScenePlan)=>FrameTarget):void {
  const frame=projectFrameAt(project,seconds);
  if(frame)renderFrame(frame.plan,frame.local,targetFor(frame.plan));
}
