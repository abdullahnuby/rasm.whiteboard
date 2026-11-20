'use strict';
(function(root){
 const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
 function aborted(session){if(session.cancelled)throw new DOMException('Export cancelled','AbortError')}
 async function withDeadline(promise,ms=45000){
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('لم يستجب محرك الترميز. جرّب دقة 720p أو متصفحًا آخر.')),ms)})])}
  finally{clearTimeout(timer)}
 }
 async function encode({canvas,duration,audio,render,session,onProgress,format='auto'}){
  const m=await import('./vendor/mediabunny.min.mjs');
  aborted(session);
  const quality=new m.Quality({bitrate:canvas.width*canvas.height>=1800000?6500000:3800000});
  const channels=audio?Math.min(2,audio.numberOfChannels):1,sampleRate=audio?audio.sampleRate:48000;
  let selected=null;
  const candidates=format==='webm'?['webm']:format==='mp4'?['mp4']:['mp4','webm'];
  for(const type of candidates){
   const videoCodec=type==='mp4'?'avc':'vp8',audioCodec=type==='mp4'?'aac':'opus';
   if(await m.canEncodeVideo(videoCodec,{width:canvas.width,height:canvas.height,quality,frameRate:24})&&
      (!audio||await m.canEncodeAudio(audioCodec,{sampleRate,numberOfChannels:channels}))){
    selected={type,videoCodec,audioCodec};break
   }
  }
  if(!selected)throw new DOMException('هذا المتصفح لا يدعم ترميز الصيغة المختارة. اختر الصيغة التلقائية أو جرّب Chrome على الكمبيوتر.','NotSupportedError');
  const output=new m.Output({format:selected.type==='mp4'?new m.Mp4OutputFormat({fastStart:'in-memory'}):new m.WebMOutputFormat(),target:new m.BufferTarget()});
  const video=new m.CanvasSource(canvas,{codec:selected.videoCodec,quality,keyFrameInterval:2});
  output.addVideoTrack(video,{frameRate:24});
  const audioSource=audio?new m.AudioBufferSource({codec:selected.audioCodec,quality:new m.Quality({bitrate:128000})}):null;
  if(audioSource)output.addAudioTrack(audioSource);
  session.cancelOutput=()=>output.cancel();
  const frameCount=Math.ceil(duration*24);
  let audioAt=0;
  try{
   await withDeadline(output.start());
   for(let index=0;index<frameCount;index++){
    aborted(session);
    const timestamp=index/24,frameDuration=Math.min(1/24,duration-timestamp);
    render(timestamp);
    await withDeadline(video.add(timestamp,frameDuration,{keyFrame:index%48===0}));
    // Interleave small audio blocks to bound both muxer and encoder queues.
    if(audioSource){
     const until=Math.min(duration,(index+1)/24);
     const end=Math.min(audio.length,Math.round(until*audio.sampleRate));
     const begin=Math.round(audioAt*audio.sampleRate);
     if(end>begin){
      const buffer=new AudioBuffer({numberOfChannels:channels,length:end-begin,sampleRate:audio.sampleRate});
      for(let channel=0;channel<channels;channel++)buffer.copyToChannel(audio.getChannelData(channel).subarray(begin,end),channel);
      await withDeadline(audioSource.add(buffer));audioAt=end/audio.sampleRate
     }
    }
    session.frameCount=index+1;
    if(index%4===0||index+1===frameCount){onProgress((index+1)/frameCount,index+1,frameCount);await yieldTask()}
   }
   video.close();audioSource?.close();
   aborted(session);onProgress(1,frameCount,frameCount,true);
   await withDeadline(output.finalize(),90000);
   aborted(session);
   return {blob:new Blob([output.target.buffer],{type:'video/'+selected.type}),frames:frameCount,method:'offline'};
  }catch(error){await output.cancel().catch(()=>{});throw error}
  finally{session.cancelOutput=null}
 }
 root.RasmOffline=Object.freeze({encode});
})(globalThis);
