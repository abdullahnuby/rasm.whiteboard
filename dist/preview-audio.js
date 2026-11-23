'use strict';
(function(root){
 function create({media,onState=()=>{}}){
  let active=false,tail=null,sourceUrl=null,asset=null,command=false;
  const now=()=>root.performance.now()/1000;
  function status(state,message){onState({state,message})}
  function stop(){active=false;tail=null;command=true;media.pause();command=false}
  function setAsset(value){
   if(value===asset)return;
   stop();asset=value;media.removeAttribute('src');media.load();
   if(sourceUrl){root.URL.revokeObjectURL(sourceUrl);sourceUrl=null}
   if(value){media.src=value.blob?(sourceUrl=root.URL.createObjectURL(value.blob)):value.data;media.muted=false;media.volume=1;media.load();status('ready','التسجيل جاهز. اضغط تشغيل الصور والصوت، أو جرّب مشغل الصوت أدناه.')}else status('empty','أضف تسجيلًا لسماعه مع الصور.');
  }
  // play() is invoked in the trusted click, not after decoding or scene preparation.
  async function ready(at=0){
   if(!asset)return;
   try{if(root.navigator?.audioSession)root.navigator.audioSession.type='playback'}catch{}
   media.muted=false;if(media.volume===0)media.volume=1;
   if(Number.isFinite(media.duration)&&at>=media.duration){active=true;tail={at,started:now()};return}
   try{
    command=true;media.currentTime=Math.max(0,at);const playing=media.play();command=false;
    await playing;active=true;tail=null;status('playing','جارٍ تشغيل التسجيل مع الصور.');
   }catch(error){command=false;active=false;status('blocked','الصوت لم يبدأ. اضغط تشغيل من مشغل الصوت أدناه. تأكد من مستوى صوت الوسائط ومخرج السماعة.');throw Error('لم يبدأ تشغيل الصوت. جرّب زر التشغيل في مشغل الصوت الظاهر أدناه. ('+(error?.name||'MediaError')+')')}
  }
  function start(at){if(!asset)return;if(!active&&!media.paused){active=true;tail=null}if(!active)throw Error('اضغط تشغيل الصوت من الزر أو المشغل الظاهر.');}
  function position(fallback){return active?(tail?tail.at+now()-tail.started:media.currentTime):fallback}
  function interrupted(){return active&&!tail&&media.paused&&!media.ended}
  media.addEventListener('ended',()=>{if(active)tail={at:media.currentTime,started:now()};status('ended','انتهى التسجيل. يمكنك الرجوع لأي موضع في الخط الزمني.')});
  media.addEventListener('error',()=>status('error','تعذّر تشغيل ملف التسجيل في المشغل. جرّب نسخة MP3 أو WAV.'));
  media.addEventListener('waiting',()=>status('waiting','جارٍ تحميل الصوت…'));
  media.addEventListener('playing',()=>status('playing','جارٍ تشغيل التسجيل مع الصور.'));
  media.addEventListener('pause',()=>{if(!command&&!media.ended)status('paused','الصوت متوقف مؤقتًا.')});
  return Object.freeze({ready,start,stop,position,interrupted,setAsset,isActive:()=>active});
 }
 root.RasmPreviewAudio=Object.freeze({create});
})(globalThis);
