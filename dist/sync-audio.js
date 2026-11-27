'use strict';
// ضبط المشاهد على التسجيل بالنقر: يستمع المستخدم للتعليق الصوتي ويضغط «التالي»
// كلما بدأ الكلام عن اللوحة التالية، فتُحسب مدة كل مشهد من الضغطات بدل سحب
// حواف المشاهد على الخط الزمني. تُزاح الضغطات تلقائيًا لأقرب فاصل صامت.
(function(){
 const dialog=el('syncDialog'),opener=el('syncAudio');
 if(!dialog||!opener)return;
 let player=null,playerUrl=null,taps=[],raf=0;

 function silenceCenters(){
  if(!soundBuffer)return[];
  const data=soundBuffer.getChannelData(0),rate=soundBuffer.sampleRate,span=Math.max(1,Math.floor(rate*0.05));
  const envelope=[];
  for(let start=0;start+span<=data.length;start+=span){
   let sum=0,count=0;
   for(let i=start;i<start+span;i+=4){sum+=data[i]*data[i];count++}
   envelope.push(Math.sqrt(sum/Math.max(1,count)));
  }
  if(!envelope.length)return[];
  const sorted=[...envelope].sort((a,b)=>a-b);
  const floor=sorted[Math.floor(sorted.length*0.3)]||0;
  const speech=sorted[Math.floor(sorted.length*0.95)]||1;
  const cut=Math.max(floor*2,speech*0.05);
  const centers=[];let begin=-1;
  const close=end=>{if(begin>=0&&(end-begin)*0.05>=0.3)centers.push((begin+end)/2*0.05);begin=-1};
  envelope.forEach((value,index)=>{const quiet=value<cut;if(quiet&&begin<0)begin=index;if(!quiet)close(index)});
  close(envelope.length);
  return centers;
 }

 function nearest(value,marks){
  let best=value,gap=Infinity;
  for(const mark of marks){const d=Math.abs(mark-value);if(d<gap){gap=d;best=mark}}
  return gap<=1?best:value;
 }

 function updateStage(){
  const index=Math.min(taps.length,scenes.length-1),scene=scenes[index];
  el('syncThumb').src=scene?.thumb||'';
  el('syncCounter').textContent='المشهد '+(index+1)+' من '+scenes.length+(taps.length?' · ضغطات: '+taps.length:'');
 }

 function tick(){
  if(!player)return;
  const total=soundBuffer?soundBuffer.duration:0;
  if(total)el('syncBar').style.width=Math.min(100,player.currentTime/total*100)+'%';
  raf=requestAnimationFrame(tick);
 }

 function stopPlayer(){
  cancelAnimationFrame(raf);
  if(player){player.pause();player.onended=null;player.src='';player=null}
  if(playerUrl){URL.revokeObjectURL(playerUrl);playerUrl=null}
 }

 function close(){stopPlayer();if(dialog.open)dialog.close()}

 function apply(){
  if(!soundBuffer||!taps.length)return;
  const marks=silenceCenters();
  const snapped=taps.map(t=>nearest(t,marks));
  for(let i=1;i<snapped.length;i++)snapped[i]=Math.max(snapped[i],snapped[i-1]+0.4);
  const bounds=[0,...snapped,soundBuffer.duration];
  const moved=snapped.some((v,i)=>Math.abs(v-taps[i])>0.05);
  stop();
  for(let i=0;i<=snapped.length&&i<scenes.length;i++){
   const seconds=Math.max(0.5,bounds[i+1]-bounds[i]);
   scenes[i].duration=seconds*(scenes[i].speed||1);
  }
  time=0;refresh();queueSave();
  el('msg').textContent='ضُبطت مدد '+(snapped.length+1)+' مشاهد على التسجيل'+(moved?' مع التقاط فواصل الصمت.':'.');
 }

 opener.onclick=()=>{
  if(!soundBuffer||scenes.length<2||loading||recording)return;
  stop();taps=[];updateStage();
  el('syncBar').style.width='0';
  el('syncState').textContent='التسجيل يعمل الآن. اضغط «التالي» عند بدء الكلام عن اللوحة التالية.';
  dialog.showModal();
  stopPlayer();
  if(soundAsset?.blob){
   playerUrl=URL.createObjectURL(soundAsset.blob);
   player=new Audio(playerUrl);
   player.onended=()=>{if(taps.length){apply()}close()};
   player.play().catch(()=>{el('syncState').textContent='الصوت لم يبدأ. اضغط «التالي» لنبدأ من جديد أو أغلق وحاول مرة أخرى.'});
   tick();
  }else el('syncState').textContent='التسجيل غير جاهز للتشغيل.';
 };

 el('syncNext').onclick=()=>{
  if(!player||!soundBuffer)return;
  const t=player.currentTime;
  if(t<0.2||t>=soundBuffer.duration-0.2)return;
  if(taps.length&&t-taps[taps.length-1]<0.3)return;
  taps.push(t);
  if(taps.length>=scenes.length-1){apply();close();return}
  updateStage();
 };
 el('syncUndo').onclick=()=>{taps.pop();updateStage()};
 el('syncFinish').onclick=()=>{if(taps.length)apply();close()};
 el('syncCancel').onclick=close;
 dialog.addEventListener('cancel',()=>{stopPlayer()});
 dialog.addEventListener('close',()=>{stopPlayer()});
})();
