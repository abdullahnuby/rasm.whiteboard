'use strict';
const el=id=>document.getElementById(id), board=el('board'), ctx=board.getContext('2d'), range=el('seek'), files=el('files');
const editorSession=new RasmEditorCore.EditorSession();
let foregroundJob=null;
function beginForeground(kind,label){foregroundJob?.cancel();return foregroundJob=editorSession.operations.begin(kind,label)}
function endForeground(){foregroundJob?.finish();foregroundJob=null}
function failForeground(error){foregroundJob?.fail(error)}
const surface=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
let scenes=[], selected=0, time=0, running=false, recording=false, start=0, frame=0, tone=0, demo=true, loading=false, lastUrl='', activeImport=null;
let timelineScale=40, audioTimeline=null, timelineDrag=null, exportSession=null, lastExportRevision=null;
const defaults={speed:.5,motionStyle:'smart',mode:'original',tone:4,sourceHand:'auto',handSize:100,weight:1.4,side:'1',hold:18,paper:'#ffffff',transition:'cut'};
const colors=['#e6af89','#986642',null], total=()=>RasmTimeline.totalSeconds(scenes), offset=i=>RasmTimeline.layout(scenes,1)[i]?.start||0;
function setOperationStatus(label,done=0,total=1){
 const panel=el('operationStatus');if(!panel)return;
 panel.hidden=false;el('operationText').textContent=label;
 const max=Math.max(1,total),value=Math.max(0,Math.min(max,done));
 foregroundJob?.progress(value/max,label);el('operationProgress').value=value/max*100;el('operationPercent').textContent=Math.round(value/max*100)+'%';
}
function clearOperationStatus(){const panel=el('operationStatus');if(panel)panel.hidden=true}
function prewarmColorSchedules(items){
 // Warm only the first scene needed for the initial preview. Playback and export
 // prepare the remaining scenes on demand rather than launching a long queue.
 const queue=items.length?[items[0]]:[];let index=0;
 const warmNext=async()=>{
  if(index>=queue.length)return;
  const scene=queue[index++];
  try{await prepareColorSchedule(scene);scene.engineScheduleError=undefined}
  catch(error){
   scene.engineScheduleError=String(error?.message||error);
   if(scenes.includes(scene)){
    refreshEngineDiagnostics(scene);
    el('msg').textContent='تعذّر تجهيز حركة بكسلات المشهد "'+scene.name+'": '+scene.engineScheduleError;
   }
  }
  setTimeout(warmNext,0);
 };
 setTimeout(warmNext,0);
}
function path(c,points,ink,width=1.4){c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);c.strokeStyle=ink;c.lineWidth=width;c.lineJoin=c.lineCap='round';c.stroke()}
function house(phase){
 const img=surface(640,360),c=img.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,640,360);
 const p=(x,y,z)=>[313+x*.94-y*.76,230+x*.28+y*.38-z];
 const line=(a,b,color='#36483d',w=1.8)=>path(c,[p(...a),p(...b)],color,w);
 const face=(v,fill)=>{c.beginPath();v.forEach((a,i)=>c[i?'lineTo':'moveTo'](...p(...a)));c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle='#36483d';c.lineWidth=2;c.stroke()};
 for(let i=-140;i<175;i+=16){line([i,-88,0],[i,108,0],'#d7dfd3',.8);line([-140,i*.6,0],[170,i*.6,0],'#d7dfd3',.8)}
 face([[-105,-55,0],[118,-55,0],[118,79,0],[-105,79,0]],'#eaf0e3');
 face([[-92,64,6],[100,64,6],[100,64,90],[-92,64,90]],'#fafbf5');face([[100,64,6],[100,-45,6],[100,-45,90],[100,64,90]],'#e5ebdc');
 for(let x=-78;x<87;x+=31){face([[x,65,20],[x+22,65,20],[x+22,65,73],[x,65,73]],'#d4dfd3');line([x+11,65,20],[x+11,65,73]);line([x,65,44],[x+22,65,44])}
 for(let y=-34;y<60;y+=8)line([101,y,8],[101,y,85],'#889780',1);
 if(phase>0){face([[-104,76,88],[112,76,88],[112,76,96],[-104,76,96]],'#d5dfca');face([[-104,76,96],[112,76,96],[112,-56,96],[-104,-56,96]],'#f3f5eb');
 face([[-68,38,96],[60,38,96],[60,38,154],[-68,38,154]],'#f9faf4');face([[60,38,96],[60,-40,96],[60,-40,154],[60,38,154]],'#dce4d5');
 for(let x=-58;x<53;x+=16){line([x,39,104],[x,39,146],'#81937d',2)}
 face([[-74,44,155],[68,44,155],[68,-46,155],[-74,-46,155]],'#eff4e6')}
 if(phase===2){for(let i=0;i<4;i++){const x=115+i*12,y=-44+i*15;line([x,y,0],[x,y,45]);for(let j=0;j<6;j++)line([x,y,16+j*5],[x-7+j*.5,y+6,28+j*4],'#798668',2)}}
 return img}
const photoHand=new Image();photoHand.src='assets/marker-hand.webp';photoHand.onload=()=>render(time);
let cache={};
globalThis.addEventListener('rasm-schedule-ready',event=>{
 if(!running&&!recording&&scenes.some(scene=>scene.lines===event.detail?.lines)){cache={};render(time)}
});
const scenePlanCompiler=new RasmEditorCore.ScenePlanCompiler();
let frameAsset=null;
function frameTarget(scene,handResources){
 if(frameAsset?.source!==scene.src){
  const scratch=surface(scene.src.width,scene.src.height),context=scratch.getContext('2d');
  frameAsset={source:scene.src,sourcePixels:scene.src.getContext('2d').getImageData(0,0,scene.src.width,scene.src.height).data,
   scratch:{image:scratch,context,pixels:context.createImageData(scene.src.width,scene.src.height)}}
 }
 if(scene.revealMode==='outline-color'&&!frameAsset.outlineMask)frameAsset.outlineMask=RasmEditorCore.createOutlineMask(frameAsset.sourcePixels,scene.src.width,scene.src.height);
 const photo=photoHand.naturalWidth?{image:photoHand,width:photoHand.naturalWidth,height:photoHand.naturalHeight}:undefined;
 const custom=typeof handImage!=='undefined'&&handImage?{image:handImage,width:handImage.naturalWidth,height:handImage.naturalHeight}:undefined;
 return {context:ctx,width:board.width,height:board.height,source:{image:scene.src,width:scene.src.width,height:scene.src.height},
  sourcePixels:frameAsset.sourcePixels,outlineMask:frameAsset.outlineMask,scratch:frameAsset.scratch,hands:handResources||{photo,custom}}
}
function compileScenePlan(scene,pixels=scene.mode==='original'?colorSchedule(scene):null){
 const id=editorSession.sceneId(scene),metadata=editorSession.project.snapshot.scenes.find(row=>row.id===id);
 if(!metadata||!scene.enginePlanV2)throw Error('المشهد غير جاهز للرسم.');
 const tip=typeof handTip!=='undefined'?[handTip.x,handTip.y]:[5,88];
 return scenePlanCompiler.compile(metadata,scene.enginePlanV2,pixels,scene.handHint,tip)
}
function captureProjectRenderer(){
 const plans=scenes.map(scene=>compileScenePlan(scene));
 const project=RasmEditorCore.createProjectPlan(plans),sources=new Map(plans.map((plan,index)=>[plan.assetId,scenes[index].src]));
 const hands={photo:photoHand.naturalWidth?{image:photoHand,width:photoHand.naturalWidth,height:photoHand.naturalHeight}:undefined,
  custom:handImage?{image:handImage,width:handImage.naturalWidth,height:handImage.naturalHeight}:undefined};
 // Snapshot plans and resource identities once. Encoding never reads live editor settings.
 return seconds=>RasmEditorCore.renderProjectFrame(project,seconds,plan=>frameTarget({src:sources.get(plan.assetId),revealMode:plan.revealMode},hands))
}
function render(t){
 const W=board.width,H=board.height;ctx.fillStyle='white';ctx.fillRect(0,0,W,H);
 if(!scenes.length){frameAsset=null;return}
 let i=0,local=t;while(i<scenes.length-1&&local>=sceneSeconds(scenes[i]))local-=sceneSeconds(scenes[i++]);
 const scene=scenes[i];let pixels=null;
 if(scene.mode==='original'){
  try{pixels=colorSchedule(scene)}
  catch(error){scene.engineScheduleError=String(error?.message||error);refreshEngineDiagnostics(scene);el('msg').textContent='خطأ في خطة رسم المشهد: '+scene.engineScheduleError}
 }
 const id=editorSession.sceneId(scene),metadata=editorSession.project.snapshot.scenes.find(row=>row.id===id);
 if(metadata&&scene.enginePlanV2&&(scene.mode!=='original'||pixels)){
  RasmEditorCore.renderFrame(compileScenePlan(scene,pixels),local,frameTarget(scene));
 }else{ctx.fillStyle=scene.paper;ctx.fillRect(0,0,W,H)}
 range.value=t;range.max=total();el('clock').textContent=formatClock(t)+' / '+formatClock(total());el('meta').textContent='المشهد '+(i+1)+' من '+scenes.length;
 if(typeof updateTimelinePlayhead==='function')updateTimelinePlayhead(t)
}

function stop(){if(typeof stopSound==='function')stopSound();running=false;cancelAnimationFrame(frame);el('play').textContent='▶︎'}
function run(end){
 stop();if(typeof startSound==='function')startSound(time);running=true;start=performance.now()-time*1000;el('play').textContent='Ⅱ';
 let lastPaint=-Infinity;const frameInterval=1000/(recording?24:30);
 function tick(now){
  try{
   time=Math.min(total(),Math.max(0,(now-start)/1000));
   if(now-lastPaint>=frameInterval||time>=total()){
    lastPaint=now;render(time);
    if(exportSession&&!exportSession.cancelled){const pct=Math.min(100,total()?time/total()*100:100);el('exportProgress').value=pct;el('exportPercent').textContent=Math.floor(pct)+'%';el('exportElapsed').textContent=time.toFixed(1)+' / '+total().toFixed(1)+' ثانية'}
   }
   if(time>=total()){stop();if(end)end()}else frame=requestAnimationFrame(tick)
  }catch(error){
   const reason=String(error?.message||error||'unknown rendering error');
   stop();
   el('msg').textContent='توقفت المعاينة بسبب خطأ في محرك الرسم: '+reason;
   if(scenes[selected]){scenes[selected].engineScheduleError=reason;refreshEngineDiagnostics(scenes[selected])}
  }
 }
 frame=requestAnimationFrame(tick)
}

function updateTimelinePlayhead(t){
 const playhead=el('timelinePlayhead');if(playhead)playhead.style.left=(Math.max(0,t)*timelineScale)+'px';
 const totalLabel=el('timelineTotal');if(totalLabel)totalLabel.textContent=RasmTimeline.formatTime(total());
}
function setAudioTimeline(duration,name,buffer){
 audioTimeline=duration>0?{duration,name:String(name||'التعليق الصوتي'),buffer}:null;renderTimeline();
}
function buildWaveform(buffer){
 const wave=document.createElement('div');wave.className='waveform';if(!buffer)return wave;
 const data=buffer.getChannelData(0),count=96,step=Math.max(1,Math.floor(data.length/count)),stride=Math.max(1,Math.floor(step/120));
 for(let i=0;i<count;i++){let peak=0;for(let j=i*step;j<Math.min(data.length,(i+1)*step);j+=stride)peak=Math.max(peak,Math.abs(data[j]));const bar=document.createElement('i');bar.style.height=(Math.max(12,peak*82))+'%';wave.append(bar)}
 return wave;
}
function syncTimelineGeometry(){
 const content=el('timelineContent'),scroll=el('timelineScroll');if(!content||!scroll)return;
 const layout=RasmTimeline.layout(scenes,timelineScale),audioDuration=audioTimeline?.duration||0,end=Math.max(total(),audioDuration);
 const width=Math.max(scroll.clientWidth||640,end*timelineScale+70,640);
 content.style.width=width+'px';el('timelineRuler').style.width=width+'px';el('timelineVideoTrack').style.width=width+'px';el('timelineAudioTrack').style.width=width+'px';
 layout.forEach(item=>{const clip=el('timelineVideoTrack').querySelector('[data-index="'+item.index+'"]');if(!clip)return;clip.style.left=(item.start*timelineScale)+'px';clip.style.width=(item.duration*timelineScale)+'px';const duration=clip.querySelector('.timelineClipDuration');if(duration)duration.textContent=item.duration.toFixed(1)+' ث'});
 if(typeof renderElementTimeline==='function')renderElementTimeline();
 time=Math.min(time,total());range.max=total();updateTimelinePlayhead(time);
}
function renderTimeline(){
 const scroll=el('timelineScroll'),content=el('timelineContent');if(!scroll||!content)return;
 const ruler=el('timelineRuler'),video=el('timelineVideoTrack'),audio=el('timelineAudioTrack');
 const layout=RasmTimeline.layout(scenes,timelineScale),audioDuration=audioTimeline?.duration||0,end=Math.max(total(),audioDuration);
 const width=Math.max(scroll.clientWidth||640,end*timelineScale+70,640);
 content.style.width=width+'px';ruler.style.width=width+'px';video.style.width=width+'px';audio.style.width=width+'px';
 ruler.replaceChildren();video.replaceChildren();audio.replaceChildren();
 const tickStep=RasmTimeline.tickStep(timelineScale,end);
 for(let t=0;t<=Math.ceil(end/tickStep)*tickStep;t+=tickStep){const tick=document.createElement('span');tick.className='timelineTick';tick.style.left=(t*timelineScale)+'px';tick.textContent=RasmTimeline.formatTime(t);ruler.append(tick)}
 for(const item of layout){
  const scene=scenes[item.index],clip=document.createElement('div');clip.className='timelineClip'+(item.index===selected?' active':'');clip.dataset.index=item.index;
  clip.style.left=(item.start*timelineScale)+'px';clip.style.width=(item.duration*timelineScale)+'px';
  const thumb=document.createElement('img');thumb.className='timelineClipThumb';thumb.src=scene.thumb;thumb.alt='';
  const copy=document.createElement('div');copy.className='timelineClipCopy';
  const name=document.createElement('strong');name.textContent=(item.index+1)+'. '+(scene.name||'مشهد '+(item.index+1));
  const duration=document.createElement('small');duration.className='timelineClipDuration';duration.textContent=item.duration.toFixed(1)+' ث';copy.append(name,duration);
  const grip=document.createElement('span');grip.className='timelineResize';grip.setAttribute('role','separator');grip.setAttribute('aria-label','اسحب لتعديل مدة المشهد');grip.title='اسحب لتغيير مدة المشهد';
  grip.addEventListener('pointerdown',event=>beginTimelineResize(item.index,event));grip.addEventListener('click',event=>{event.preventDefault();event.stopPropagation()});
  clip.append(thumb,copy,grip);clip.addEventListener('click',()=>pick(item.index));video.append(clip);
 }
 if(audioTimeline){
  audio.hidden=false;const audioClip=document.createElement('div');audioClip.className='timelineAudioClip';audioClip.style.width=(audioTimeline.duration*timelineScale)+'px';
  const label=document.createElement('strong');label.textContent='♫ '+audioTimeline.name;
  const duration=document.createElement('small');duration.textContent=RasmTimeline.formatTime(audioTimeline.duration);
  audioClip.append(label,buildWaveform(audioTimeline.buffer),duration);audio.append(audioClip);
 }else audio.hidden=true;
 if(typeof renderElementTimeline==='function')renderElementTimeline();
 updateTimelinePlayhead(time);
}
function beginTimelineResize(index,event){
 if(recording||loading||!scenes[index])return;event.preventDefault();event.stopPropagation();stop();
 try{event.currentTarget.setPointerCapture(event.pointerId)}catch{}
 timelineDrag={index,startX:event.clientX,startDuration:sceneSeconds(scenes[index])};document.body.classList.add('timeline-resizing');
}
document.addEventListener('pointermove',event=>{
 if(!timelineDrag)return;
 const scene=scenes[timelineDrag.index],next=RasmTimeline.clampSeconds(timelineDrag.startDuration+(event.clientX-timelineDrag.startX)/timelineScale);
 scene.duration=RasmTimeline.durationForSeconds(next,scene.speed);
 if(selected===timelineDrag.index)el('duration').value=sceneSeconds(scene).toFixed(1);
 syncTimelineGeometry();render(time);
});
function finishTimelineResize(){
 if(!timelineDrag)return;timelineDrag=null;document.body.classList.remove('timeline-resizing');renderTimeline();queueSave();render(time);
}
document.addEventListener('pointerup',finishTimelineResize);document.addEventListener('pointercancel',finishTimelineResize);
el('timelineContent').addEventListener('click',event=>{
 if(event.target.closest('.timelineClip,.timelineResize'))return;
 const content=el('timelineContent'),x=event.clientX-content.getBoundingClientRect().left;
 stop();time=Math.min(total(),Math.max(0,x/timelineScale));render(time);
});
el('zoomIn').onclick=()=>{timelineScale=Math.min(80,timelineScale+6);renderTimeline()};
el('zoomOut').onclick=()=>{timelineScale=Math.max(.5,timelineScale-6);renderTimeline()};
el('zoomFit').onclick=()=>{const seconds=Math.max(total(),audioTimeline?.duration||0);timelineScale=Math.max(.5,Math.min(80,(el('timelineScroll').clientWidth-50)/Math.max(1,seconds)));renderTimeline()};

function pick(i){stop();selected=i;time=offset(i)+sceneSeconds(scenes[i])*.75;refresh();const clip=el('timelineVideoTrack').querySelector('[data-index="'+i+'"]');clip?.scrollIntoView({block:'nearest',inline:'nearest'})}
function refreshEngineDiagnostics(scene){
 const panel=el('engineDiagnosticsPanel');
 if(!panel)return;
 panel.hidden=!scene;
 if(!scene){el('engineDiagnosticsText').textContent='لا يوجد مشهد محدد.';return}
 const analysis=scene.engineAnalysisV2?.diagnostics||{};
 const plan=scene.enginePlanV2?.diagnostics||scene.engineDiagnostics||{};
 const warnings=[...(analysis.warnings||[]),...(plan.warnings||[])];
 const rows=[
  'إصدار المحرك: '+(analysis.engineVersion||'—'),
  'مكونات الصورة: '+(analysis.componentCount??'—'),
  'عناصر الرسم: '+(plan.elementCount??analysis.elementCount??'—'),
  'المسارات المُسنَدة: '+(plan.assignedPaths??'—'),
  'المسارات المقسمة حسب الملكية: '+(plan.splitPaths??'—'),
  'حدود مستعادة من البكسلات: '+(plan.tracedComponents??'—'),
  'مكونات بلا مسار قلم: '+(plan.componentsWithoutStrokes??'—'),
  'بكسلات بلا توقيت: '+(plan.rasterPixelsWithoutSeed??'—')
 ];
 if(scene.engineScheduleError)rows.push('خطأ الجدولة: '+scene.engineScheduleError);
 if(warnings.length)rows.push('تحذيرات:\n'+warnings.join('\n'));
 el('engineDiagnosticsText').textContent=rows.join('\n');
}
function refresh(){editorSession.synchronize(scenes,selected,el('titleView').textContent);if(typeof refreshGuide==='function')refreshGuide();const current=scenes[selected]||defaults;el('speed').value=current.speed||1;el('motionStyle').value=current.motionStyle||'smart';el('elementDirection').value=current.elementDirection||'rtl';el('sceneTime').textContent=scenes.length?'مدة المشهد بعد ضبط السرعة: '+sceneSeconds(current).toFixed(1)+' ث':'';el('sourceHand').value=current.sourceHand;el('handSize').value=current.handSize;el('sizeValue').value=current.handSize+'%';el('weight').value=current.weight;el('zoneEdit').disabled=!scenes.length;el('elementEdit').disabled=!scenes.length;el('handState').textContent=current.sourceHand==='present'?'تُستخدم اليد الظاهرة في الصورة.':current.handHint&&current.sourceHand==='auto'?'إذا ظهرت يد في الصورة، اختر «الصورة تتضمّن يدًا».':current.handHint&&current.sourceHand==='detect'?'أُخفيت اليد بناءً على الفحص.':'';el('style').value=current.mode;el('revealMode').value=current.revealMode||'direct';el('revealMode').disabled=current.mode!=='original';el('side').value=current.side;el('paper').value=current.paper;el('hold').value=current.hold;el('holdValue').value=current.hold+'%';el('transition').value=current.transition;el('sceneName').value=current.name||'';document.querySelectorAll('#hands button').forEach((b,i)=>b.classList.toggle('active',Number(b.dataset.tone)===current.tone));range.max=total();el('duration').value=scenes.length?sceneSeconds(scenes[selected]).toFixed(1):'6';el('count').textContent=scenes.length+' مشاهد';el('cards').replaceChildren();scenes.forEach((s,i)=>{const b=document.createElement('button');b.className='card'+(i===selected?' active':'');const img=new Image();img.src=s.thumb;const caption=document.createElement('span');caption.textContent=(i+1)+' · '+s.name;b.append(img,caption);b.onclick=()=>pick(i);el('cards').append(b)});
 el('earlier').disabled=selected<=0;el('later').disabled=selected>=scenes.length-1;for(const id of ['export','play','remove','duration','seek'])el(id).disabled=!scenes.length;
 if(!scenes.length){el('clock').textContent='0:00 / 0:00';el('meta').textContent='';range.value=0}renderTimeline();render(time);refreshEngineDiagnostics(scenes[selected]||null);if(typeof refreshGuide==='function')refreshGuide()}
function setBoardResolution(longEdge){const r=+el('ratio').value;const width=r>=1?longEdge:Math.round(longEdge*r/2)*2;const height=r>=1?Math.round(longEdge/r/2)*2:longEdge;if(board.width!==width||board.height!==height){board.width=width;board.height=height}render(time)}
function size(){setBoardResolution(Math.min(960,+el('quality').value))}
function exportSize(){setBoardResolution(+el('quality').value)}
function move(d){let j=selected+d;[scenes[selected],scenes[j]]=[scenes[j],scenes[selected]];pick(j)}
el('earlier').onclick=()=>move(-1);el('later').onclick=()=>move(1);el('remove').onclick=()=>{stop();removedScenes.push({at:selected,scene:scenes[selected]});el('undoRemove').disabled=false;scenes.splice(selected,1);if(scenes.length)pick(Math.min(selected,scenes.length-1));else{time=selected=0;refresh()}};
el('duration').oninput=e=>{
 if(!scenes[selected]||e.target.value===''||!Number.isFinite(Number(e.target.value)))return;
 stop();scenes[selected].duration=RasmTimeline.durationForSeconds(e.target.value,scenes[selected].speed);
 syncTimelineGeometry();render(time);
 el('sceneTime').textContent='مدة المشهد · '+sceneSeconds(scenes[selected]).toFixed(1)+' ث';
 if(typeof refreshGuide==='function')refreshGuide();queueSave()
};
el('duration').onchange=()=>{if(scenes[selected])pick(selected)};
el('ratio').onchange=el('quality').onchange=size;const fields={revealMode:'revealMode',sourceHand:'sourceHand',handSize:'handSize',weight:'weight',style:'mode',side:'side',paper:'paper',transition:'transition',sceneName:'name',hold:'hold'};
for(const [id,key] of Object.entries(fields))el(id).onchange=()=>{if(!scenes[selected])return;scenes[selected][key]=['hold','weight','handSize'].includes(id)?Number(el(id).value):el(id).value;if(key==='mode')cache={};refresh()};
async function replanSelectedScene(label){
 const scene=scenes[selected];if(!scene)return;
 busy(true);setOperationStatus(label,0,1);
 try{
  await applyZones(scene);
  cache={};refresh();queueSave();
  el('msg').textContent='اكتمل تحديث خطة الرسم.';
 }catch(error){
  scene.engineScheduleError=String(error?.message||error);
  refreshEngineDiagnostics(scene);
  el('msg').textContent='تعذّر تحديث خطة الرسم: '+scene.engineScheduleError;
 }finally{clearOperationStatus();busy(false)}
}
el('motionStyle').onchange=async()=>{
 if(!scenes[selected])return;
 scenes[selected].motionStyle=el('motionStyle').value;
 await replanSelectedScene('إعادة بناء خطة مسارات الرسم…');
};
el('elementDirection').onchange=async()=>{
 if(!scenes[selected])return;
 scenes[selected].elementDirection=el('elementDirection').value;
 await replanSelectedScene('إعادة ترتيب عناصر الرسم…');
};
el('downloadEngineDiagnostics').onclick=async()=>{
 const scene=scenes[selected];if(!scene)return;
 try{
  let schedule;
  if(scene.mode==='original'){await prepareColorSchedule(scene);schedule=buildColorSchedule(scene);}
  const report=RasmWhiteboardCore.createEngineReport(scene.engineAnalysisV2,scene.enginePlanV2,schedule);
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='rasm-engine-scene-'+(selected+1)+'-diagnostics.json';
  link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
 }catch(error){
  el('engineDiagnosticsText').textContent+='\n\nتعذّر بناء تقرير الجدولة: '+String(error.message||error);
 }
};
el('addFiles').onclick=()=>files.click();range.oninput=()=>{stop();time=+range.value;render(time)};
for(const [id,label,icon] of [[4,'فوتوغرافية',''],[0,'مرسومة','✍🏻'],[1,'داكنة','✍🏾'],[2,'بدون يد','∅']]){
 const b=document.createElement('button');b.dataset.tone=id;if(id===4){const img=new Image();img.src='assets/marker-hand.webp';img.alt='';b.append(img)}else{const mark=document.createElement('b');mark.textContent=icon;b.append(mark)}b.append(label);b.onclick=()=>{if(!scenes[selected])return;scenes[selected].tone=id;refresh()};el('hands').append(b)
}
const digits=s=>s.replace(/[٠-٩]/g,ch=>String(ch.charCodeAt(0)-1632)).replace(/[۰-۹]/g,ch=>String(ch.charCodeAt(0)-1776)),cmp=new Intl.Collator('ar',{numeric:true});
const MAX_IMAGES=150,MAX_IMAGE_BYTES=25*1048576;
const MAX_PROJECT_PIXELS=48_000_000,MAX_PROJECT_SCENES=150;
const IMAGE_EXT=/\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i;
function isImageFile(file){return file?.type?.startsWith('image/')||IMAGE_EXT.test(file?.name||'')}
function currentProjectPixels(){return demo?0:scenes.reduce((sum,scene)=>sum+(scene.src?.width||0)*(scene.src?.height||0),0)}
function updateBatchStatus(label,done,total){
 const status=el('batchStatus'),progress=el('batchProgress'),count=el('batchCount'),text=el('batchLabel');
 status.hidden=false;text.textContent=label;progress.max=Math.max(1,total);progress.value=Math.min(done,total);
 count.textContent=done+' / '+total;
}
el('batchCancel').onclick=()=>{
 if(!activeImport)return;
 activeImport.cancelled=true;
 foregroundJob?.cancel();
 RasmImageEngine.cancelPending?.('تم إلغاء تحليل الصورة بناءً على طلب المستخدم.');
 el('batchCancel').disabled=true;
 el('batchLabel').textContent='جارٍ إنهاء الصورة الحالية…';
};
async function importFiles(items){
 if(recording||loading||activeImport)return;
 const all=[...items],imageItems=all.filter(isImageFile);
 const unknown=all.length-imageItems.length;
 if(!imageItems.length){el('msg').textContent=unknown?'لم يتم العثور على ملفات صور صالحة.':'اختار صورًا للرفع.';return}
 imageItems.sort((a,b)=>cmp.compare(digits(a.name),digits(b.name)));
 const availableSlots=Math.max(0,MAX_PROJECT_SCENES-(demo?0:scenes.length));
 let bad=Math.max(0,imageItems.length-availableSlots)+unknown;
 const candidates=imageItems.slice(0,availableSlots);
 const controller={cancelled:false};activeImport=controller;
 const added=[],failures=[];let done=0,projectPixels=currentProjectPixels();
 stop();busy(true,'importing');foregroundJob?.signal.addEventListener('abort',()=>{controller.cancelled=true},{once:true});el('batchCancel').disabled=false;
 updateBatchStatus('بدء تجهيز الصور…',0,candidates.length);
 try{
  for(const file of candidates){
   if(controller.cancelled)break;
   done++;
   if(file.size>MAX_IMAGE_BYTES){bad++;updateBatchStatus('تخطي '+file.name+' · أكبر من 25 ميجابايت',done,candidates.length);continue}
   const url=URL.createObjectURL(file);
   try{
    const img=new Image();img.src=url;await img.decode();
    const dimensions=RasmReliability.fitDimensions(img.naturalWidth||img.width,img.naturalHeight||img.height,960,720);
    if(!dimensions||!RasmReliability.withinPixelBudget(projectPixels,dimensions.pixels,MAX_PROJECT_PIXELS)){
     bad++;updateBatchStatus('تم تخطي '+file.name+' · حد ذاكرة المشروع',done,candidates.length);continue;
    }
    updateBatchStatus('تحليل '+file.name,done-1,candidates.length);
    const scene=await RasmImageEngine.analyzeAsync(img,file.name);
    scene.asset=file;await applyZones(scene);added.push(scene);projectPixels+=dimensions.pixels;
    updateBatchStatus('تم تجهيز '+added.length+' صورة · '+file.name,done,candidates.length);
   }catch(error){
    bad++;
    const reason=String(error?.message||error||'unknown error');
    failures.push(file.name+': '+reason);
    updateBatchStatus('فشل تجهيز '+file.name+' · '+reason.slice(0,110),done-1,candidates.length);
   }
   finally{URL.revokeObjectURL(url)}
  }
  if(added.length){
   if(demo){scenes=[];clearRemoved()}
   demo=false;
   const first=scenes.length;scenes.push(...added);prewarmColorSchedules(added);pick(first);queueSave();
  }
  const cancelled=controller.cancelled;
  const detail=failures.length?'\nتفاصيل أول الأخطاء: '+failures.slice(0,3).join(' | ')+(failures.length>3?' | وأخطاء أخرى: '+(failures.length-3):''):'';
  el('msg').textContent=(added.length?'تم تجهيز '+added.length+' مشهد. ':'')+
   (bad?' تم تخطي '+bad+' ملف. ':'')+
   (cancelled?'تم إلغاء الدفعة بعد اكتمال الصورة الحالية.':unknown?'تم تجاهل الملفات غير المدعومة.':'')+detail;
 }finally{
  activeImport=null;el('batchStatus').hidden=true;el('batchCancel').disabled=false;busy(false);files.value='';
 }
}
files.onchange=async()=>{const items=[...files.files];files.value='';await importMedia(items)};document.ondragover=e=>e.preventDefault();document.ondrop=e=>{e.preventDefault();importMedia([...e.dataTransfer.files])};
el('exportCancel').onclick=()=>{
 if(!exportSession)return;exportSession.cancelled=true;foregroundJob?.cancel();stop();exportSession.cancelOutput?.().catch(()=>{});
 if(exportSession.rec&&exportSession.rec.state!=='inactive')exportSession.rec.stop();
 el('exportLabel').textContent='جارٍ إيقاف التصدير بأمان…';el('exportCancel').disabled=true;
};
el('exportClose').onclick=()=>{if(!exportSession)el('exportPanel').hidden=true};
el('export').onclick=async()=>{
 if(recording||loading||!scenes.length)return;
 stop();const session={cancelled:false,frameCount:0,revision:saveRevision};exportSession=session;
 const previousTime=time,duration=total(),msg=el('msg');
 const lock=flag=>{if(flag)beginForeground('exporting','تصدير الفيديو');else endForeground();recording=flag;document.querySelector('.workflow').inert=flag;document.querySelector('main .grid').inert=flag;document.querySelector('.intro').inert=flag;el('export').disabled=flag;el('projectMenu').disabled=flag;if(typeof syncDrawer==='function')syncDrawer()};
 lock(true);el('exportPanel').hidden=false;el('exportPanel').scrollIntoView({block:'start'});el('exportCancel').hidden=false;el('exportCancel').disabled=false;el('exportClose').hidden=true;
 el('exportPreview').pause();el('exportPreview').hidden=true;el('download').hidden=true;
 el('exportProgress').value=0;el('exportPercent').textContent='0%';el('exportLabel').textContent='تجهيز المشاهد للتصدير…';
 let wakeLock;
 try{
  wakeLock=await navigator.wakeLock?.request('screen').catch(()=>null);
  if(scenes.some(s=>s.tone===4&&overlayEnabled(s)))await photoHand.decode();
  for(let i=0;i<scenes.length;i++){
   if(session.cancelled)throw new DOMException('Cancelled','AbortError');
   await prepareColorSchedule(scenes[i]);
   strokeProgress(scenes[i],0);
   el('exportElapsed').textContent='تجهيز المشهد '+(i+1)+' من '+scenes.length;
   await new Promise(resolve=>setTimeout(resolve,0))
  }
  time=0;cache={};exportSize();
  const progress=(fraction,done,count,finalizing)=>{
   foregroundJob?.progress(fraction,'إنشاء الفيديو');el('exportProgress').value=fraction*100;
   el('exportPercent').textContent=Math.floor(fraction*100)+'%';
   el('exportElapsed').textContent=done+' / '+count+' إطار';
   el('exportLabel').textContent=finalizing?'إنهاء ملف الفيديو…':'إنشاء الفيديو · '+duration.toFixed(1)+' ثانية'
  };
  const renderExportFrame=captureProjectRenderer();
  const options={canvas:board,duration,audio:soundBuffer,render:t=>{time=t;renderExportFrame(t)},session,onProgress:progress,format:el('exportFormat').value};
  let result;
  if(el('exportEngine').value==='live'||typeof VideoEncoder!=='function'||(soundBuffer&&typeof AudioEncoder!=='function'))result=await RasmLive.encode(options);
  else result=await RasmOffline.encode(options);
  if(session.cancelled)throw new DOMException('Cancelled','AbortError');
  if(result.blob.size<1024)throw Error('لم ينتج محرك التصدير ملفًا صالحًا.');
  const preview=el('exportPreview'),oldUrl=lastUrl;
  lastUrl=URL.createObjectURL(result.blob);lastExportRevision=session.revision;preview.src=lastUrl;preview.hidden=false;preview.load();
  if(oldUrl)URL.revokeObjectURL(oldUrl);
  const link=el('download');link.href=lastUrl;link.download='rasm-whiteboard.'+RasmExport.fileExtension(result.blob.type);link.hidden=false;
  el('exportProgress').value=100;el('exportPercent').textContent='100%';
  el('exportLabel').textContent='الفيديو جاهز للتنزيل';
  el('exportElapsed').textContent=duration.toFixed(1)+' ثانية · '+result.frames+' إطار · '+(result.blob.size/1048576).toFixed(1)+' MB';
  msg.textContent='اكتمل إنشاء الفيديو. يمكنك معاينته وتنزيله من الزر أدناه.';
 }catch(error){
  const cancelled=session.cancelled||error.name==='AbortError';
  el('exportLabel').textContent=cancelled?'تم إلغاء التصدير':'تعذّر إكمال التصدير';
  msg.textContent=cancelled?'يمكنك متابعة التحرير وإعادة التصدير.':String(error.message||error);
 }finally{
  await wakeLock?.release().catch(()=>{});stop();recordBus=null;exportSession=null;lock(false);time=previousTime;size();
  el('exportCancel').hidden=true;el('exportClose').hidden=false;el('exportCancel').disabled=false
 }
};

scenes=[];selected=0;time=0;size();refresh();

el('allOriginal').onclick=()=>{if(!scenes.length)return;stop();for(const s of scenes)s.mode='original';cache={};pick(selected);queueSave();el('msg').textContent='تم تطبيق ألوان الصور الأصلية على كل المشاهد.'};

function updateSpeed(all){
 if(!scenes.length)return;
 const speed=Number(el('speed').value);
 for(const scene of all?scenes:[scenes[selected]])scene.speed=speed;
 pick(selected);queueSave()
}
el('speed').onchange=()=>updateSpeed(false);
el('allSpeed').onclick=()=>updateSpeed(true);

function formatClock(t){const seconds=Math.floor(t);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')}
