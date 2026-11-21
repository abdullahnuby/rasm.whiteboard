import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const core=vm.runInNewContext((await readFile('dist/motion.js','utf8'))+';({edgeSkinRegion,overlayEnabled,applyZones,sceneSeconds,strokeProgress,strokeTravelPlan,strokeRevealTime,routeStrokes,orderShapeGroups})');
const pixels=new Uint8ClampedArray(100*100*4).fill(255);
assert.equal(core.edgeSkinRegion(pixels,100,100),false);
for(let y=30;y<100;y++)for(let x=42;x<68;x++)pixels.set([163,109,82,255],(y*100+x)*4);
assert.equal(core.edgeSkinRegion(pixels,100,100),true);
for(const tone of [0,1,3,4]){
 assert.equal(core.overlayEnabled({tone,handHint:true,sourceHand:'auto'}),true);
 assert.equal(core.overlayEnabled({tone,handHint:true,sourceHand:'detect'}),false);
 assert.equal(core.overlayEnabled({tone,handHint:false,sourceHand:'present'}),false);
 assert.equal(core.overlayEnabled({tone,handHint:true,sourceHand:'clean'}),true);
}
assert.equal(core.overlayEnabled({tone:2,sourceHand:'clean'}),false);
const first={points:[[80,80],[90,80]]},second={points:[[10,10],[20,10]]};
const scene={src:{width:100,height:100},zones:[{x:0,y:0,w:.3,h:.3}],baseLines:[first,second]};
core.applyZones(scene);
assert.deepEqual(Array.from(scene.lines[0].points),second.points.slice().reverse());
assert.equal(scene.lines[1].start,2);
const centerStroke={points:[[50,50],[60,50]]};
const adaptive={src:{width:100,height:100},zones:[],baseLines:[first,second],centerBaseLines:[centerStroke],motionStyle:'smart'};
core.applyZones(adaptive);
assert.deepEqual(Array.from(adaptive.lines[0].points),centerStroke.points.slice().reverse());
assert.equal(adaptive.length,2);
adaptive.motionStyle='contour';core.applyZones(adaptive);
assert.deepEqual(Array.from(adaptive.lines[0].points),first.points.slice().reverse());
assert.equal(adaptive.length,4);
if(process.argv[2]){
 const bytes=await readFile(process.argv[2]);
 assert.equal(core.edgeSkinRegion(bytes,485,493),true);
}
const {colorSchedule,revealPixels}=vm.runInNewContext((await readFile('dist/motion.js','utf8'))+';({colorSchedule,revealPixels})');
const source=Uint32Array.from([0xff0000ff,0xff00ff00,0xffff0000,0xff007fff,0xffff33aa,0xff884411]);
for(const lines of [[],[{start:0,points:[[0,0],[1,0],[2,0]]}]]){
 const layer={...colorSchedule({src:{width:3,height:2},length:3,lines}),source,output:new Uint32Array(6),count:0};
 revealPixels(layer,.5);assert.ok(layer.count>0&&layer.count<6);
 for(let i=0;i<6;i++)assert.ok(layer.output[i]===0||layer.output[i]===source[i]);
 revealPixels(layer,1);assert.deepEqual(layer.output,source);
 revealPixels(layer,0);assert.deepEqual(layer.output,new Uint32Array(6));
}
// Exercise the same frame renderer used for playback and recording across
// scene boundaries, including a flat, warm-coloured second image.
const app=await readFile('dist/app.js','utf8');
const helperCode=app.slice(app.indexOf('function pointAt('),app.indexOf('function house('));
const frameCode=helperCode+app.slice(app.indexOf('function render(t)'),app.indexOf('function stop()'));
const imageData=(w,h)=>({data:new Uint8ClampedArray(w*h*4)});
let lineToCount=0;const canvasContext={fillRect(){},save(){},restore(){},translate(){},scale(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){lineToCount++},stroke(){},createImageData:imageData,putImageData(){}};
const strokes=[{start:0,points:[[0,0],[1,0],[1,1],[2,1]]}];
const frames=[false,true,false].map(flat=>({
 duration:2,hold:10,mode:'original',tone:4,side:'1',handSize:100,sourceHand:'auto',handHint:flat,lines:flat?[]:strokes,length:flat?0:4,
 src:{width:4,height:4,getContext:()=>({getImageData:()=>imageData(4,4)})}
}));
const hands=[];
const render=vm.runInNewContext(frameCode+';render',{
 formatClock:t=>String(t),sceneSeconds:core.sceneSeconds,strokeProgress:core.strokeProgress,scenes:frames,board:{width:128,height:72},ctx:canvasContext,range:{},el:()=>({}),cache:{},total:()=>6,
 surface:()=>({getContext:()=>canvasContext}),colorSchedule,revealPixels,overlayEnabled:core.overlayEnabled,drawHand:(_,x,y)=>hands.push([x,y])
});
for(const t of [.8,2.8,4.8,2.4]){const before=hands.length;render(t);assert.equal(hands.length,before+1)}
frames[1].sourceHand='present';render(2.8);assert.equal(hands.length,4);
frames[0].mode='ink';frames[0].hold=0;
frames[0].lines=[{start:0,points:Array.from({length:100},(_,i)=>[i,0])}];frames[0].length=100;
const beforeInk=lineToCount;render(.5);const firstInk=lineToCount-beforeInk;
render(1);const secondInk=lineToCount-beforeInk;
assert.ok(firstInk>0&&secondInk-firstInk>0,'Incremental hand path should add visible segments');
assert.ok(secondInk<firstInk*2.5,'Previously painted path segments must not be redrawn on every frame');

assert.equal(core.sceneSeconds({duration:6,speed:.5}),12);
assert.equal(core.sceneSeconds({duration:6,speed:.1}),60);
assert.equal(core.sceneSeconds({duration:6}),6);
const spaced={length:4,lines:[{start:0,points:[[0,0],[1,0]]},{start:2,points:[[11,0],[12,0]]}]};
const halfway=core.strokeProgress(spaced,.5);
assert.equal(halfway.target,2);assert.equal(halfway.tip[0],6);
assert.equal(core.strokeProgress(spaced,1).target,4);
const interpolated=core.strokeProgress(spaced,11.5/12);
assert.equal(interpolated.drawing,true);
assert.ok(Math.abs(interpolated.target-2.5)<1e-9);
assert.ok(Math.abs(interpolated.tip[0]-11.5)<1e-9);

// Equal physical distances must consume equal time even if point density differs.
const uneven={length:4,lines:[{start:0,points:[[0,0],[1,0],[100,0],[101,0]]}]};
const middle=core.strokeProgress(uneven,.5);
assert.ok(Math.abs(middle.tip[0]-50.5)<1e-6);
const near=core.strokeProgress(uneven,.01);
assert.ok(near.target<2,'Dense and sparse sections must use arc length');
assert.ok(Math.abs(middle.progress-.5)<1e-9&&Math.abs(near.progress-.01)<1e-9,
 'Hand progress must expose the same normalized physical travel used by image reveal');
const unevenPlan=core.strokeTravelPlan(uneven.lines);
assert.equal(unevenPlan.end,101);
assert.equal(core.strokeRevealTime(unevenPlan.segments[0],1,unevenPlan.end),2);
assert.equal(core.strokeRevealTime(unevenPlan.segments[0],2,unevenPlan.end),227,
 'Pixel reveal timing must follow physical path distance, not point index');
const routed=vm.runInNewContext((await readFile('dist/motion.js','utf8'))+';routeStrokes');
const far={points:[[90,0],[100,0]]},close={points:[[12,0],[20,0]]},origin={points:[[0,0],[10,0]]};
const route=routed([origin,far,close]);
assert.deepEqual(Array.from(route[1].points[0]),[20,0],'The next stroke should begin at the endpoint nearest the previous stroke');
assert.deepEqual(Array.from(route[1].points.at(-1)),[12,0]);
const horizontalLeft={id:'left',points:[[0,0],[10,0]]},horizontalRight={id:'right',points:[[90,0],[100,0]]};
const rtlRoute=core.routeStrokes([horizontalLeft,horizontalRight],'rtl');
const ltrRoute=core.routeStrokes([horizontalLeft,horizontalRight],'ltr');
assert.equal(rtlRoute[0].points[0][0],100,'RTL route should start at the rightmost end');
assert.equal(ltrRoute[0].points[0][0],0,'LTR route should start at the leftmost end');
const row=[{id:'left',bounds:{x:4,y:0,width:8,height:8,cx:8,cy:4}},{id:'right',bounds:{x:80,y:0,width:8,height:8,cx:84,cy:4}}];
assert.deepEqual(Array.from(core.orderShapeGroups(row,'rtl').map(g=>g.id)),['right','left']);
assert.deepEqual(Array.from(core.orderShapeGroups(row,'ltr').map(g=>g.id)),['left','right']);
const shapeA={points:[[90,10],[95,10]]},shapeB={points:[[70,10],[75,10]]},shapeC={points:[[20,10],[25,10]]};
const grouped={
 src:{width:120,height:60},zones:[],motionStyle:'smart',shapeSequence:'smart',elementDirection:'rtl',
 baseLines:[shapeA,shapeB,shapeC],centerBaseLines:[shapeA,shapeB,shapeC],
 centerShapeGroups:[
  {id:1,lineIndices:[0,1],componentLabels:[4,5],bounds:{x:68,y:8,width:28,height:5},area:50},
  {id:2,lineIndices:[2],componentLabels:[6],bounds:{x:18,y:8,width:10,height:5},area:25}
 ],contourShapeGroups:[],shapeMetrics:{backend:'builtin-components',shapes:2}
};
core.applyZones(grouped);
assert.equal(grouped.shapeGroups.length,2,'Smart sequencing must keep related paths in one shape');
assert.deepEqual(Array.from(grouped.shapeGroups.map(g=>g.pathCount)),[2,1]);
assert.equal(grouped.lines[0].shapeId,1);
assert.equal(grouped.lines.at(-1).shapeId,2);
assert.ok(grouped.shapeGroups[0].bounds.cx>grouped.shapeGroups[1].bounds.cx,
 'RTL element order must draw the rightmost object first');
assert.deepEqual(Array.from(grouped.shapeGroups[0].rasterComponentLabels),[1]);
grouped.elementDirection='ltr';core.applyZones(grouped);
assert.ok(grouped.shapeGroups[0].bounds.cx<grouped.shapeGroups[1].bounds.cx,
 'LTR element order must draw the leftmost object first');
assert.equal(grouped.shapeGroups[0].id,1);

assert.deepEqual(Array.from(grouped.shapeGroups[0].rasterComponentLabels),[4,5]);
assert.deepEqual(Array.from(grouped.shapeGroups[1].rasterComponentLabels),[6]);
grouped.shapeSequence='strokes';core.applyZones(grouped);
assert.equal(grouped.shapeGroups.length,3,'Stroke mode must expose individual paths');
assert.ok(grouped.shapeGroups.every(g=>g.pathCount===1));

