'use strict';
(function(root){
 function create({getContext,getBuffer}){
  let source=null,clock=null;
  function stop(){
   clock=null;
   if(source){try{source.stop()}catch{}source.disconnect();source=null}
  }
  // Called directly from a trusted play/seek click, before asynchronous scene preparation.
  async function ready(){
   if(!getBuffer())return;
   try{if(root.navigator?.audioSession)root.navigator.audioSession.type='playback'}catch{}
   const context=getContext();let timer;
   try{
    await Promise.race([context.resume(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('لم يسمح المتصفح بتشغيل الصوت. اضغط التشغيل مرة أخرى.')),6000)})]);
    if(context.state!=='running')throw Error('الصوت متوقف. اضغط التشغيل مرة أخرى وأبقِ التطبيق في المقدمة.');
   }finally{clearTimeout(timer)}
  }
  function start(at){
   stop();const buffer=getBuffer();if(!buffer)return;
   const context=getContext();
   if(context.state!=='running')throw Error('الصوت متوقف. اضغط التشغيل مرة أخرى.');
   clock={context,at,started:context.currentTime};
   if(at>=buffer.duration)return;
   source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.start(0,Math.max(0,at));
  }
  function position(fallback){return clock?clock.at+Math.max(0,clock.context.currentTime-clock.started):fallback}
  function interrupted(){return !!clock&&clock.context.state!=='running'}
  return Object.freeze({ready,start,stop,position,interrupted});
 }
 root.RasmPreviewAudio=Object.freeze({create});
})(globalThis);
