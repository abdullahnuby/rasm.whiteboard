'use strict';
(function(root){
 const MIME_CANDIDATES=[
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
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
 root.RasmExport=Object.freeze({MIME_CANDIDATES:Object.freeze(MIME_CANDIDATES),pickMimeType,frameDue,fileExtension});
})(typeof window!=='undefined'?window:globalThis);
