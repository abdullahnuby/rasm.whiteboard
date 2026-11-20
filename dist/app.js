'use strict';
const el=id=>document.getElementById(id), board=el('board'), ctx=board.getContext('2d'), range=el('seek'), files=el('files');
const surface=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
let scenes=[], selected=0, time=0, running=false, recording=false, start=0, frame=0, tone=0, demo=true, loading=false, lastUrl='', activeImport=null;
let timelineScale=40, audioTimeline=null, timelineDrag=null, exportSession=null;
function recordExportFrame(force=false){
 const session=exportSession;if(!recording||!session?.manualFrames||session.cancelled||!session.videoTrack?.requestFrame)return;
 const now=performance.now();if(!RasmExport.frameDue(now,session.lastFrameAt,1000/30,force))return;
 session.lastFrameAt=now;try{session.videoTrack.requestFrame();session.frameCount++}catch(error){session.frameErrors++;session.lastFrameError=String(error?.message||error)}
}
const defaults={speed:.5,mode:'original',tone:4,sourceHand:'auto',handSize:100,weight:1.4,side:'1',hold:18,paper:'#ffffff',transition:'cut'};
const colors=['#e6af89','#986642',null], total=()=>RasmTimeline.totalSeconds(scenes), offset=i=>RasmTimeline.layout(scenes,1)[i]?.start||0;
function setOperationStatus(label,done=0,total=1){
 const panel=el('operationStatus');if(!panel)return;
 panel.hidden=false;el('operationText').textContent=label;
 const max=Math.max(1,total),value=Math.max(0,Math.min(max,done));
 el('operationProgress').value=value/max*100;el('operationPercent').textContent=Math.round(value/max*100)+'%';
}
function clearOperationStatus(){const panel=el('operationStatus');if(panel)panel.hidden=true}
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
function drawHand(c,x,y,scale,tone,side){
 if(tone===4){if(!photoHand.naturalWidth)return;const w=scale*190,h=w*photoHand.height/photoHand.width;c.save();c.translate(x,y);c.scale(Number(side),1);c.drawImage(photoHand,-w*.052,-h*.15,w,h);c.restore();return}
 if(tone===2)return;
 if(tone===3 && handImage){const w=scale*112,h=w*handImage.height/handImage.width;c.save();c.translate(x,y);c.scale(Number(side),1);c.drawImage(handImage,-w*handTip.x/100,-h*handTip.y/100,w,h);c.restore();return}
 c.save();c.translate(x,y);c.scale(scale*Number(side),scale);c.rotate(-.12);
 c.fillStyle='#273c31';c.beginPath();c.moveTo(0,0);c.lineTo(4,-10);c.lineTo(42,-46);c.quadraticCurveTo(46,-48,49,-42);c.lineTo(9,-5);c.closePath();c.fill();
 c.fillStyle=colors[tone];c.strokeStyle='#765544';c.lineWidth=1.4;c.beginPath();c.moveTo(22,-18);c.bezierCurveTo(15,-20,10,-15,13,-11);c.quadraticCurveTo(19,-7,31,-13);c.quadraticCurveTo(25,-5,31,0);c.quadraticCurveTo(40,9,54,13);c.lineTo(79,34);c.lineTo(99,11);c.lineTo(74,-7);c.quadraticCurveTo(64,-23,52,-31);c.quadraticCurveTo(43,-37,36,-32);c.lineTo(20,-23);c.quadraticCurveTo(15,-16,22,-18);c.fill();c.stroke();path(c,[[22,-18],[35,-22],[42,-18]],'#906c53');path(c,[[32,-13],[41,-16],[48,-12]],'#906c53');c.restore()}
let cache={};
function render(t){
 const W=board.width,H=board.height;ctx.fillStyle='white';ctx.fillRect(0,0,W,H);
 if(!scenes.length)return;let i=0,local=t;while(i<scenes.length-1 && local>=sceneSeconds(scenes[i]))local-=sceneSeconds(scenes[i++]);
 const s=scenes[i],mode=s.mode,duration=sceneSeconds(s),drawTime=duration*(1-s.hold/100),frac=Math.min(1,local/drawTime),motion=strokeProgress(s,mode==='original'?Math.min(1,frac/.86):frac),target=motion.target;
 ctx.fillStyle=s.paper;ctx.fillRect(0,0,W,H);
 if(cache.s!==s || cache.mode!==mode || cache.weight!==s.weight || target<cache.t){let lay=surface(s.src.width,s.src.height);cache={s,mode,weight:s.weight,lay,c:lay.getContext('2d'),idx:0,t:0}}
 let tip;
 const original=mode==='original';
 while(cache.idx<s.lines.length){
  const line=s.lines[cache.idx];if(line.start+line.points.length>target)break;
  if(!original)path(cache.c,line.points,mode==='color'?line.color:'#29362e',s.weight);
  cache.idx++
 }
 if(original&&!cache.pixels){
  const plan=colorSchedule(s);
  if(plan){
   const data=s.src.getContext('2d').getImageData(0,0,s.src.width,s.src.height);
   const image=cache.c.createImageData(s.src.width,s.src.height);
   cache.pixels={...plan,source:new Uint32Array(data.data.buffer),output:new Uint32Array(image.data.buffer),image,count:0};
  }
 }
 if(original&&cache.pixels){
  let reveal=frac/.96;
  if(s.length)reveal=frac<.86?target/s.length*230/256:(230+(frac-.86)/.10*26)/256;
  if(revealPixels(cache.pixels,Math.min(1,reveal)))cache.c.putImageData(cache.pixels.image,0,0)
 }
 cache.t=target;const sc=Math.min(W/s.src.width,H/s.src.height)*.96,ox=(W-sc*s.src.width)/2,oy=(H-sc*s.src.height)/2;
 ctx.save();ctx.translate(ox,oy);ctx.scale(sc,sc);ctx.drawImage(cache.lay,0,0);
 if(original&&!cache.pixels){const reveal=Math.min(1,frac/.96);ctx.save();ctx.beginPath();ctx.rect(0,0,s.src.width,s.src.height*reveal);ctx.clip();ctx.drawImage(s.src,0,0);ctx.restore()}
 const l=s.lines[cache.idx];if(l){const visible=Math.max(1,target-l.start);tip=motion.tip||l.points[visible-1];if(!original)path(ctx,l.points.slice(0,visible),mode==='color'?l.color:'#29362e',s.weight)}
 if(!tip && original && !s.length && frac<.96 && cache.pixels){
  const pixels=cache.pixels;
  const pixel=pixels.order[Math.max(0,pixels.count-1)];
  tip=[pixel%s.src.width,Math.floor(pixel/s.src.width)]
 }
 if(mode==='fill' && frac===1){ctx.globalAlpha=Math.min(1,s.hold===0?1:(local-drawTime)/Math.min(.6,duration*s.hold/100));ctx.drawImage(s.src,0,0);ctx.globalAlpha=1}
 ctx.restore();if(tip&&overlayEnabled(s))drawHand(ctx,ox+tip[0]*sc,oy+tip[1]*sc,Math.min(W,H)/425*s.handSize/100,s.tone,s.side);
 if(s.transition==='fade'){ctx.globalAlpha=Math.max(0,1-(duration-local)/Math.min(.45,duration*.22));ctx.fillStyle=s.paper;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1}
 range.value=t;range.max=total();el('clock').textContent=t.toFixed(1)+' / '+total().toFixed(1)+' s';el('meta').textContent=(i+1)+' / '+scenes.length;if(typeof updateTimelinePlayhead==='function')updateTimelinePlayhead(t);
 if(typeof recordExportFrame==='function')recordExportFrame()
}
function stop(){if(typeof stopSound==='function')stopSound();running=false;cancelAnimationFrame(frame);el('play').textContent='▶'}
function run(end){
 stop();if(typeof startSound==='function')startSound(time);running=true;start=performance.now()-time*1000;el('play').textContent='Ⅱ';
 let lastPaint=-Infinity;const frameInterval=1000/30;
 function tick(now){
  time=Math.min(total(),Math.max(0,(now-start)/1000));
  if(now-lastPaint>=frameInterval||time>=total()){
   lastPaint=now;render(time);
   if(exportSession&&!exportSession.cancelled){const pct=Math.min(100,total()?time/total()*100:100);el('exportProgress').value=pct;el('exportPercent').textContent=Math.floor(pct)+'%';el('exportElapsed').textContent=time.toFixed(1)+' / '+total().toFixed(1)+' ثانية'}
  }
  if(time>=total()){stop();if(end)end()}else frame=requestAnimationFrame(tick)
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
 time=Math.min(time,total());range.max=total();updateTimelinePlayhead(time);
}
function renderTimeline(){
 const scroll=el('timelineScroll'),content=el('timelineContent');if(!scroll||!content)return;
 const ruler=el('timelineRuler'),video=el('timelineVideoTrack'),audio=el('timelineAudioTrack');
 const layout=RasmTimeline.layout(scenes,timelineScale),audioDuration=audioTimeline?.duration||0,end=Math.max(total(),audioDuration);
 const width=Math.max(scroll.clientWidth||640,end*timelineScale+70,640);
 content.style.width=width+'px';ruler.style.width=width+'px';video.style.width=width+'px';audio.style.width=width+'px';
 ruler.replaceChildren();video.replaceChildren();audio.replaceChildren();
 const tickStep=Math.max(5,Math.ceil((end/100)/5)*5);
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
function refresh(){const current=scenes[selected]||defaults;el('speed').value=current.speed||1;el('sceneTime').textContent=scenes.length?'مدة المشهد بعد ضبط السرعة: '+sceneSeconds(current).toFixed(1)+' ث':'';el('sourceHand').value=current.sourceHand;el('handSize').value=current.handSize;el('sizeValue').value=current.handSize+'%';el('weight').value=current.weight;el('zoneEdit').disabled=!scenes.length;el('handState').textContent=current.sourceHand==='present'?'إيد الصورة الأصلية فقط':current.handHint&&current.sourceHand==='auto'?'لو الصورة فيها إيد فعلًا، اختار «الصورة فيها إيد بالفعل».':current.handHint&&current.sourceHand==='detect'?'تم إخفاء الإيد بناءً على الفحص.':'';el('style').value=current.mode;el('side').value=current.side;el('paper').value=current.paper;el('hold').value=current.hold;el('holdValue').value=current.hold+'%';el('transition').value=current.transition;el('sceneName').value=current.name||'';document.querySelectorAll('#hands button').forEach((b,i)=>b.classList.toggle('active',Number(b.dataset.tone)===current.tone));range.max=total();el('duration').value=scenes.length?sceneSeconds(scenes[selected]).toFixed(1):'6';el('count').textContent=scenes.length+' مشاهد';el('cards').replaceChildren();scenes.forEach((s,i)=>{const b=document.createElement('button');b.className='card'+(i===selected?' active':'');const img=new Image();img.src=s.thumb;const caption=document.createElement('span');caption.textContent=(i+1)+' · '+s.name;b.append(img,caption);b.onclick=()=>pick(i);el('cards').append(b)});
 el('earlier').disabled=selected<=0;el('later').disabled=selected>=scenes.length-1;for(const id of ['export','play','remove','duration','seek'])el(id).disabled=!scenes.length;
 if(!scenes.length){el('clock').textContent='0 s';el('meta').textContent='';range.value=0}renderTimeline();render(time)}
function setBoardResolution(longEdge){const r=+el('ratio').value;const width=r>=1?longEdge:Math.round(longEdge*r/2)*2;const height=r>=1?Math.round(longEdge/r/2)*2:longEdge;if(board.width!==width||board.height!==height){board.width=width;board.height=height}render(time)}
function size(){setBoardResolution(Math.min(960,+el('quality').value))}
function exportSize(){setBoardResolution(+el('quality').value)}
function move(d){let j=selected+d;[scenes[selected],scenes[j]]=[scenes[j],scenes[selected]];pick(j)}
el('earlier').onclick=()=>move(-1);el('later').onclick=()=>move(1);el('remove').onclick=()=>{stop();removedScenes.push({at:selected,scene:scenes[selected]});el('undoRemove').disabled=false;scenes.splice(selected,1);if(scenes.length)pick(Math.min(selected,scenes.length-1));else{time=selected=0;refresh()}};
el('duration').onchange=e=>{if(!scenes[selected])return;scenes[selected].duration=RasmTimeline.durationForSeconds(e.target.value,scenes[selected].speed);pick(selected);queueSave()};
el('ratio').onchange=el('quality').onchange=size;const fields={sourceHand:'sourceHand',handSize:'handSize',weight:'weight',style:'mode',side:'side',paper:'paper',transition:'transition',sceneName:'name',hold:'hold'};
for(const [id,key] of Object.entries(fields))el(id).onchange=()=>{if(!scenes[selected])return;scenes[selected][key]=['hold','weight','handSize'].includes(id)?Number(el(id).value):el(id).value;refresh()};
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
 el('batchCancel').disabled=true;
 el('batchLabel').textContent='جاري إنهاء الصورة الحالية…';
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
 const added=[];let done=0,projectPixels=currentProjectPixels();
 stop();busy(true);el('batchCancel').disabled=false;
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
    added.push(scene);projectPixels+=dimensions.pixels;
    updateBatchStatus('تم تجهيز '+added.length+' صورة · '+file.name,done,candidates.length);
   }catch{bad++;updateBatchStatus('تعذّر فتح '+file.name,done,candidates.length)}
   finally{URL.revokeObjectURL(url)}
  }
  if(added.length){
   if(demo){scenes=[];clearRemoved()}
   demo=false;
   const first=scenes.length;scenes.push(...added);pick(first);queueSave();
  }
  const cancelled=controller.cancelled;
  el('msg').textContent=(added.length?'تم تجهيز '+added.length+' مشهد. ':'')+
   (bad?' تم تخطي '+bad+' ملف. ':'')+
   (cancelled?'تم إلغاء الدفعة بعد اكتمال الصورة الحالية.':unknown?'تم تجاهل الملفات غير المدعومة.':'');
 }finally{
  activeImport=null;el('batchStatus').hidden=true;el('batchCancel').disabled=false;busy(false);files.value='';
 }
}
files.onchange=async()=>{const items=[...files.files];files.value='';await importMedia(items)};document.ondragover=e=>e.preventDefault();document.ondrop=e=>{e.preventDefault();importMedia([...e.dataTransfer.files])};
el('exportCancel').onclick=()=>{
 if(!exportSession)return;exportSession.cancelled=true;stop();
 if(exportSession.rec&&exportSession.rec.state!=='inactive')exportSession.rec.stop();
 el('exportLabel').textContent='جاري إيقاف التصدير بأمان…';el('exportCancel').disabled=true;
};
el('exportClose').onclick=()=>{if(!exportSession)el('exportPanel').hidden=true};
el('export').onclick=async()=>{
 if(recording||loading||!scenes.length)return;const msg=el('msg');
 if(!window.MediaRecorder||!board.captureStream){msg.textContent='التصدير غير متاح في المتصفح ده. افتح الأداة على Chrome للكمبيوتر.';return}
 let stream,rec;const session={cancelled:false,failed:false,rec:null,manualFrames:false,videoTrack:null,lastFrameAt:-Infinity,frameCount:0,frameErrors:0};exportSession=session;
 const lock=flag=>{document.querySelector('main .grid').inert=flag;document.querySelector('.intro').inert=flag;el('export').disabled=flag;el('projectMenu').disabled=flag;recording=flag};
 const showStopped=label=>{el('exportCancel').hidden=true;el('exportCancel').disabled=false;el('exportClose').hidden=false;el('exportLabel').textContent=label};
 try{
  lock(true);stop();time=0;exportSize();el('exportPanel').hidden=false;el('exportCancel').hidden=false;el('exportCancel').disabled=false;el('exportClose').hidden=true;
  const preview=el('exportPreview');preview.pause();preview.hidden=true;
  el('exportLabel').textContent='تجهيز محرك التصدير…';el('exportProgress').value=0;el('exportPercent').textContent='0%';el('exportElapsed').textContent='0.0 / '+total().toFixed(1)+' ثانية';
  if(scenes.some(s=>s.tone===4&&overlayEnabled(s)))await photoHand.decode();
  await readySound();
  if(session.cancelled){lock(false);size();exportSession=null;showStopped('تم إلغاء التصدير');return}
  // Capture every completed paint explicitly when the browser exposes requestFrame().
  try{
   stream=board.captureStream(0);session.videoTrack=stream.getVideoTracks()[0];
   session.manualFrames=!!session.videoTrack&&typeof session.videoTrack.requestFrame==='function';
   if(!session.manualFrames){stream.getTracks().forEach(track=>track.stop());stream=board.captureStream(30);session.videoTrack=stream.getVideoTracks()[0]}
  }catch{
   stream?.getTracks().forEach(track=>track.stop());stream=board.captureStream(30);session.videoTrack=stream.getVideoTracks()[0];session.manualFrames=false;
  }
  if(soundBuffer){recordBus=audioContext.createMediaStreamDestination();stream.addTrack(recordBus.stream.getAudioTracks()[0])}
  const mimeType=RasmExport.pickMimeType(MediaRecorder);
  const options={videoBitsPerSecond:8500000,audioBitsPerSecond:128000};if(mimeType)options.mimeType=mimeType;
  rec=new MediaRecorder(stream,options);session.rec=rec;
  const chunks=[];rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  rec.onerror=()=>{
   session.failed=true;el('exportLabel').textContent='حدث خطأ أثناء تسجيل الفيديو';
   msg.textContent='توقف المسجل بسبب خطأ. لم يتم اعتماد الملف الناتج.';stop();
   if(rec.state!=='inactive')rec.stop();
  };
  rec.onstop=()=>{
   recordBus=null;stream.getTracks().forEach(track=>track.stop());lock(false);size();
   const cancelled=session.cancelled,failed=session.failed;exportSession=null;
   if(cancelled){showStopped('تم إلغاء التصدير');el('exportPercent').textContent='—';el('exportElapsed').textContent='لم يتم إنشاء ملف';msg.textContent='تم إلغاء عملية التصدير.';return}
   const actualMime=rec.mimeType||chunks.find(chunk=>chunk.type)?.type||mimeType||'video/webm';
   const blob=new Blob(chunks,{type:actualMime});
   if(failed||!chunks.length||blob.size<1024){
    showStopped('لم يكتمل التصدير');el('exportPercent').textContent='—';
    msg.textContent='ملف التصدير فارغ أو غير مكتمل. راجع المتصفح وحاول بصيغة أخرى.';return;
   }
   const oldUrl=lastUrl;lastUrl=URL.createObjectURL(blob);
   preview.src=lastUrl;preview.hidden=false;preview.load();if(oldUrl)URL.revokeObjectURL(oldUrl);
   const a=el('download');a.href=lastUrl;a.download='rasm-whiteboard.'+RasmExport.fileExtension(actualMime);a.hidden=false;a.click();
   el('exportProgress').value=100;el('exportPercent').textContent='100%';
   el('exportElapsed').textContent=total().toFixed(1)+' ثانية';
   showStopped('اكتمل التصدير · '+actualMime+' · '+(blob.size/1048576).toFixed(1)+' MB');
   msg.textContent='تم إنشاء الفيديو. شغّل معاينة الملف الناتج قبل استخدامه.';
  };
  el('exportLabel').textContent='جاري إنشاء الفيديو من المشاهد…';rec.start(1000);
  if(session.manualFrames){session.lastFrameAt=performance.now();render(time);recordExportFrame(true)}
  run(()=>{
   if(session.cancelled)return;recordExportFrame(true);
   setTimeout(()=>{
    if(rec.state==='inactive')return;
    try{rec.requestData()}catch{}
    setTimeout(()=>{if(rec.state!=='inactive')rec.stop()},180);
   },180);
  });
 }catch(error){
  recordBus=null;stream?.getTracks().forEach(track=>track.stop());lock(false);size();exportSession=null;
  showStopped('تعذّر بدء التصدير');
  msg.textContent='تعذّر بدء التصدير: '+String(error?.message||error).slice(0,180);
 }
};
scenes=['التكوين الأساسي','الكتلة المعمارية','التفاصيل النهائية'].map((n,i)=>RasmImageEngine.analyze(house(i),n));selected=1;time=offset(1)+sceneSeconds(scenes[1])*.68;size();refresh();

el('allOriginal').onclick=()=>{if(!scenes.length)return;stop();for(const s of scenes)s.mode='original';cache={};pick(selected);queueSave();el('msg').textContent='تم تطبيق ألوان الصور الأصلية على كل المشاهد.'};

function updateSpeed(all){
 if(!scenes.length)return;
 const speed=Number(el('speed').value);
 for(const scene of all?scenes:[scenes[selected]])scene.speed=speed;
 pick(selected);queueSave()
}
el('speed').onchange=()=>updateSpeed(false);
el('allSpeed').onclick=()=>updateSpeed(true);
