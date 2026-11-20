'use strict';
globalThis.RasmLive=Object.freeze({
 async encode({canvas,duration,audio,render,session,onProgress,format}){
  if(!canvas.captureStream||typeof MediaRecorder!=='function')throw Error('التصدير غير مدعوم في هذا المتصفح. افتح المشروع على Chrome أو Safari حديث.');
  let stream,rec,context,source,timer;
  const chunks=[];
  try{
   stream=canvas.captureStream(24);
   if(audio){
    context=new AudioContext();await context.resume();
    const destination=context.createMediaStreamDestination();
    source=context.createBufferSource();source.buffer=audio;source.connect(destination);
    stream.addTrack(destination.stream.getAudioTracks()[0])
   }
   const candidates=RasmExport.MIME_CANDIDATES.filter(t=>format==='auto'||t.startsWith('video/'+format));
   const mimeType=candidates.find(t=>MediaRecorder.isTypeSupported(t));
   if(format!=='auto'&&!mimeType)throw Error('الصيغة المختارة غير مدعومة في التسجيل المتوافق. اختر تلقائي.');
   rec=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),videoBitsPerSecond:5000000,audioBitsPerSecond:128000});
   rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   await new Promise((resolve,reject)=>{
    let error=null,finishing=false;
    const finish=problem=>{
     if(finishing)return;finishing=true;error=problem;clearTimeout(timer);
     try{source?.stop()}catch{}
     if(rec.state!=='inactive')rec.stop();else problem?reject(problem):resolve()
    };
    session.cancelOutput=async()=>finish(new DOMException('Cancelled','AbortError'));
    rec.onerror=e=>finish(e.error||Error('تعذّر تسجيل الفيديو.'));
    rec.onstop=()=>error?reject(error):resolve();
    render(0);rec.start(1000);const start=performance.now();
    source?.start();
    function tick(){
     if(session.cancelled)return finish(new DOMException('Cancelled','AbortError'));
     if(document.hidden)return finish(Error('توقف التسجيل لأن الصفحة أصبحت في الخلفية. استخدم التصدير الدقيق أو أبقِ الصفحة في المقدمة.'));
     const t=Math.min(duration,(performance.now()-start)/1000);
     try{render(t)}catch(error){finish(error);return}
     session.frameCount++;onProgress(t/duration,Math.floor(t*24),Math.ceil(duration*24));
     if(t>=duration){timer=setTimeout(()=>finish(),100);return}
     timer=setTimeout(tick,1000/24)
    }
    tick()
   });
   return {blob:new Blob(chunks,{type:rec.mimeType}),frames:session.frameCount,method:'live'};
  }finally{
   clearTimeout(timer);session.cancelOutput=null;
   try{source?.stop()}catch{}
   if(rec?.state!=='inactive')try{rec?.stop()}catch{}
   stream?.getTracks().forEach(t=>t.stop());await context?.close()
  }
 }
});
