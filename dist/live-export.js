'use strict';
(function(root){
 function deadline(promise,ms,message){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms)})]).finally(()=>clearTimeout(timer))}
 function prepareAudio(){
  let context;
  try{
   const Ctor=root.AudioContext||root.webkitAudioContext;
   if(typeof Ctor!=='function')throw Error('التسجيل بالصوت غير مدعوم في هذا المتصفح.');
   context=new Ctor();
   // Invoke resume in the export button's trusted click, before any awaited preparation.
   const ready=deadline(context.resume(),6000,'لم يسمح المتصفح بتشغيل الصوت. اضغط التصدير من جديد وأبقِ الصفحة مفتوحة.');
   ready.catch(()=>{});return{context,ready};
  }catch(error){const ready=Promise.reject(error);ready.catch(()=>{});return{context,ready}}
 }
 function mimeFor(format='auto',hasAudio=false){
  if(typeof root.MediaRecorder!=='function'||typeof root.MediaRecorder.isTypeSupported!=='function')return null;
  const candidates=RasmExport.MIME_CANDIDATES.filter(type=>{
   if(format!=='auto'&&!type.startsWith('video/'+format))return false;
   if(hasAudio&&type.startsWith('video/mp4')&&!type.includes('mp4a'))return format==='mp4'&&type==='video/mp4';
   return true;
  });
  return candidates.find(type=>{try{return root.MediaRecorder.isTypeSupported(type)}catch{return false}})??(format==='auto'?'':null);
 }
 function canEncode({canvas,format='auto',audio}){return typeof canvas.captureStream==='function'&&mimeFor(format,!!audio)!==null}
 async function encode({canvas,duration,audio,render,session,onProgress,format='auto',preparedAudio}){
  if(!canEncode({canvas,format,audio}))throw new DOMException('الصيغة المختارة غير مدعومة في التسجيل المتوافق. اختر تلقائي أو صيغة يدعمها هذا المتصفح.','NotSupportedError');
  let stream,rec,context,source,timer,stopTimer;const chunks=[];
  try{
   if(session.cancelled)throw new DOMException('Cancelled','AbortError');
   stream=canvas.captureStream(24);
   const videoTrack=stream.getVideoTracks()[0];
   const draw=time=>{render(time);if(typeof videoTrack?.requestFrame==='function')videoTrack.requestFrame()};
   if(audio){
    const prepared=preparedAudio||prepareAudio();context=prepared.context;await prepared.ready;
    if(context?.state!=='running')throw Error('لم يبدأ تشغيل الصوت. اضغط التصدير من جديد بعد إبقاء التطبيق في المقدمة.');
    const destination=context.createMediaStreamDestination();source=context.createBufferSource();source.buffer=audio;source.connect(destination);
    const track=destination.stream.getAudioTracks()[0];if(!track)throw Error('تعذّر إنشاء مسار الصوت.');stream.addTrack(track);
   }
   if(session.cancelled)throw new DOMException('Cancelled','AbortError');
   const mimeType=mimeFor(format,!!audio);
   rec=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),videoBitsPerSecond:canvas.width*canvas.height>=1800000?6500000:5000000,audioBitsPerSecond:128000});
   rec.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)};
   await new Promise((resolve,reject)=>{
    let error=null,finishing=false;
    const finish=problem=>{
     if(finishing)return;finishing=true;error=problem;clearTimeout(timer);
     try{source?.stop()}catch{}
     if(rec.state!=='inactive'){
      stopTimer=setTimeout(()=>reject(problem||Error('لم ينتهِ حفظ التسجيل. أعد المحاولة أو اختر صيغة أخرى.')),10000);
      try{rec.stop()}catch(cause){clearTimeout(stopTimer);reject(problem||cause)}
     }else problem?reject(problem):resolve();
    };
    session.cancelOutput=async()=>finish(new DOMException('Cancelled','AbortError'));
    rec.onerror=event=>finish(event.error||Error('تعذّر تسجيل الفيديو.'));
    rec.onstop=()=>{clearTimeout(stopTimer);error?reject(error):resolve()};
    draw(0);rec.start(1000);
    if(/^video\/mp4/i.test(rec.mimeType)&&/opus|vp0?8|vp0?9|av01|hvc1|hev1/i.test(rec.mimeType)){
     finish(new DOMException('هذا المتصفح لا ينتج MP4 بترميز H.264 وصوت AAC. اختر تلقائي أو WebM.','NotSupportedError'));return;
    }
    const start=performance.now();source?.start();
    function tick(){
     if(session.cancelled)return finish(new DOMException('Cancelled','AbortError'));
     if(document.hidden)return finish(Error('توقف التسجيل لأن الصفحة أصبحت في الخلفية. أبقِ التطبيق في المقدمة أو استخدم محرك التصدير الدقيق.'));
     const t=Math.min(duration,(performance.now()-start)/1000);
     try{draw(t)}catch(error){finish(error);return}
     session.frameCount++;onProgress(t/duration,Math.floor(t*24),Math.ceil(duration*24));
     if(t>=duration){timer=setTimeout(()=>finish(),100);return}
     // Anchor the next tick to the recording clock; rendering time must not add drift.
     const next=(Math.floor((performance.now()-start)*24/1000)+1)*1000/24;
     timer=setTimeout(tick,Math.max(0,start+next-performance.now()));
    }
    tick();
   });
   if(!chunks.length)throw Error('لم ينتج التسجيل بيانات فيديو. جرّب صيغة أخرى أو التصدير على الكمبيوتر.');
   return{blob:new Blob(chunks,{type:rec.mimeType}),frames:session.frameCount,method:'live'};
  }finally{
   clearTimeout(timer);clearTimeout(stopTimer);session.cancelOutput=null;
   try{source?.stop()}catch{}
   if(rec?.state!=='inactive')try{rec?.stop()}catch{}
   stream?.getTracks().forEach(track=>track.stop());if(!preparedAudio)try{await context?.close()}catch{}
  }
 }
 root.RasmLive=Object.freeze({encode,prepareAudio,canEncode});
})(globalThis);
