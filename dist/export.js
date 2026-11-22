'use strict';
(function(root){
 const MIME_CANDIDATES=[
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  'video/mp4;codecs="avc1,mp4a.40.2"',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm'
 ];
 function pickMimeType(MediaRecorderCtor){
  if(typeof MediaRecorderCtor?.isTypeSupported!=='function')return '';
  return MIME_CANDIDATES.find(type=>{try{return MediaRecorderCtor.isTypeSupported(type)}catch{return false}})||'';
 }
 function frameDue(now,lastFrameAt,interval=1000/30,force=false){
  if(force)return true;
  if(!Number.isFinite(now)||!Number.isFinite(interval)||interval<=0)return false;
  return !Number.isFinite(lastFrameAt)||now-lastFrameAt>=interval;
 }
 function fileExtension(mimeType){return /^video\/mp4(?:;|$)/i.test(String(mimeType||''))?'mp4':'webm'}
 function codecUnavailable(error){
  return error?.name==='NotSupportedError'||/not supported|unsupported|لا يدعم/i.test(String(error?.message||''));
 }
 async function encodeWithFallback({preferLive,canLive,offline,live,onFallback,session}){
  if(preferLive)return live();
  try{return await offline()}
  catch(error){
   if(session.cancelled||session.frameCount>0||!codecUnavailable(error)||!canLive())throw error;
   onFallback(error);return live();
  }
 }
 async function inspectOutput(blob,{audioRequired=false,width,height}={}){
  const m=await import('./vendor/mediabunny.min.mjs');
  const input=new m.Input({source:new m.BlobSource(blob),formats:m.ALL_FORMATS});
  try{
   const video=await input.getPrimaryVideoTrack(),audio=await input.getPrimaryAudioTrack(),format=await input.getFormat();
   if(!video||!(await new m.EncodedPacketSink(video).getFirstPacket())?.data?.byteLength)throw Error('لم يتضمن الملف بيانات فيديو صالحة.');
   if(audioRequired&&(!audio||!(await new m.EncodedPacketSink(audio).getFirstPacket())?.data?.byteLength))throw Error('لم يتضمن الملف التعليق الصوتي. لم يُعتمد التصدير؛ جرّب صيغة أخرى.');
   if(format.name==='MP4'&&(video.codec!=='avc'||(audio&&audio.codec!=='aac')))throw new DOMException('هذا المتصفح لا ينتج MP4 بترميز H.264 وصوت AAC. اختر تلقائي أو WebM، أو صدّر MP4 على جهاز يدعم هذه الصيغة.','NotSupportedError');
   if(video.codedWidth!==width||video.codedHeight!==height)throw Error('غيّر المتصفح دقة الفيديو أثناء التسجيل. لم يُعتمد الملف؛ جرّب دقة أخرى.');
   return{container:format.name,videoCodec:video.codec,audioCodec:audio?.codec||null,width:video.codedWidth,height:video.codedHeight};
  }finally{input.dispose()}
 }
 root.RasmExport=Object.freeze({MIME_CANDIDATES:Object.freeze(MIME_CANDIDATES),pickMimeType,frameDue,fileExtension,codecUnavailable,encodeWithFallback,inspectOutput});
})(typeof window!=='undefined'?window:globalThis);
