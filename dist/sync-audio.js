'use strict';
// ضبط ثواني المشاهد على التسجيل: مشغل صوت ومعاه قائمة المشاهد، لكل مشهد
// ثانية بداية ونهاية يكتبها المستخدم أو يلتقطها من موضع المشغل بزر 📍.
// البداية مربوطة بنهاية المشهد السابق حتى يبقى الفيديو متصلًا بلا فجوات،
// وعند التطبيق تتحول (النهاية − البداية) إلى مدة كل مشهد.
(function(){
 const dialog=el('syncDialog'),opener=el('syncAudio');
 if(!dialog||!opener)return;
 let player=null,playerUrl=null,raf=0,rows=[],segStop=-1;

 const fmt=v=>(Math.round(v*10)/10).toFixed(1);

 function stopPlayer(){
  cancelAnimationFrame(raf);
  if(player){player.pause();player.onended=null;player.src='';player=null}
  if(playerUrl){URL.revokeObjectURL(playerUrl);playerUrl=null}
  el('syncPlay').textContent='▶︎';
 }
 function close(){stopPlayer();if(dialog.open)dialog.close()}

 function tick(){
  if(!player)return;
  const total=soundBuffer?soundBuffer.duration:0;
  el('syncTime').textContent=fmt(player.currentTime)+' / '+fmt(total);
  if(total)el('syncSeek').value=Math.round(player.currentTime/total*1000);
  if(segStop>=0&&player.currentTime>=segStop){segStop=-1;player.pause();el('syncPlay').textContent='▶︎'}
  raf=requestAnimationFrame(tick);
 }

 function renderRows(){
  const host=el('syncRows');
  host.replaceChildren();
  rows.forEach((row,i)=>{
   const scene=scenes[i],item=document.createElement('div');
   item.className='syncRow';
   const img=document.createElement('img');img.src=scene.thumb||'';img.alt='';
   const body=document.createElement('div');body.className='syncRowBody';
   const title=document.createElement('div');title.className='syncRowTitle';
   title.textContent=(i+1)+' · '+(scene.name||'مشهد');
   const times=document.createElement('div');times.className='syncRowTimes';
   const fromLabel=document.createElement('label');fromLabel.textContent='من ';
   const from=document.createElement('input');from.type='number';from.min='0';from.step='0.1';from.inputMode='decimal';from.value=fmt(row.start);from.dataset.i=i;from.dataset.k='start';
   fromLabel.append(from,' ث');
   const toLabel=document.createElement('label');toLabel.textContent='إلى ';
   const to=document.createElement('input');to.type='number';to.min='0';to.step='0.1';to.inputMode='decimal';to.value=fmt(row.end);to.dataset.i=i;to.dataset.k='end';
   toLabel.append(to,' ث');
   const dur=document.createElement('output');dur.id='syncDur'+i;dur.textContent=fmt(row.end-row.start)+' ث';
   times.append(fromLabel,toLabel,dur);
   const btns=document.createElement('div');btns.className='syncRowBtns';
   const hear=document.createElement('button');hear.type='button';hear.textContent='⏵ اسمع';hear.dataset.act='seg';hear.dataset.i=i;
   const pinStart=document.createElement('button');pinStart.type='button';pinStart.textContent='📍 بداية';pinStart.dataset.act='start';pinStart.dataset.i=i;
   const pinEnd=document.createElement('button');pinEnd.type='button';pinEnd.textContent='📍 نهاية';pinEnd.dataset.act='end';pinEnd.dataset.i=i;
   btns.append(hear,pinStart,pinEnd);
   body.append(title,times,btns);item.append(img,body);host.append(item);
  });
 }

 function refreshDurations(){
  rows.forEach((row,i)=>{const out=el('syncDur'+i);if(out)out.textContent=fmt(Math.max(0,row.end-row.start))+' ث'});
 }

 function setBoundary(i,value){
  const total=soundBuffer?soundBuffer.duration:Infinity;
  value=Math.min(Math.max(0,value),total);
  if(i>0)value=Math.max(value,rows[i-1].end+0.3);
  if(i<rows.length-1)value=Math.min(value,rows[i+1].start-0.3);
  rows[i].start=value;rows[i-1]&&(rows[i-1].end=value);
  return value;
 }
 function setEnd(i,value){
  const total=soundBuffer?soundBuffer.duration:Infinity;
  value=Math.min(Math.max(0,value),total);
  value=Math.max(value,rows[i].start+0.3);
  rows[i].end=value;rows[i+1]&&(rows[i+1].start=value);
  return value;
 }

 function syncInputs(){
  el('syncRows').querySelectorAll('input[type=number]').forEach(input=>{
   const i=+input.dataset.i;
   input.value=fmt(input.dataset.k==='start'?rows[i].start:rows[i].end);
  });
  refreshDurations();
 }

 el('syncRows').addEventListener('change',event=>{
  const input=event.target.closest('input[type=number]');
  if(!input)return;
  const i=+input.dataset.i,value=parseFloat(input.value);
  if(!Number.isFinite(value)){syncInputs();return}
  if(input.dataset.k==='start')setBoundary(i,value);else setEnd(i,value);
  syncInputs();
 });
 el('syncRows').addEventListener('click',event=>{
  const button=event.target.closest('button[data-act]');
  if(!button||!player)return;
  const i=+button.dataset.i,act=button.dataset.act;
  if(act==='seg'){
   player.currentTime=rows[i].start;segStop=rows[i].end;
   player.play().then(()=>{el('syncPlay').textContent='⏸'}).catch(()=>{});
  }else if(act==='start'){setBoundary(i,player.currentTime);syncInputs()}
  else{setEnd(i,player.currentTime);syncInputs()}
 });

 el('syncPlay').onclick=()=>{
  if(!player)return;
  if(player.paused)player.play().then(()=>{el('syncPlay').textContent='⏸'}).catch(()=>{el('syncState').textContent='الصوت لم يبدأ. اضغط مرة أخرى.'});
  else{player.pause();el('syncPlay').textContent='▶︎'}
 };
 el('syncSeek').addEventListener('input',()=>{
  if(!player||!soundBuffer)return;
  player.currentTime=el('syncSeek').value/1000*soundBuffer.duration;
 });
 el('syncApply').onclick=()=>{
  if(!rows.length)return;
  for(const row of rows)if(row.end-row.start<0.3){el('syncState').textContent='كل مشهد يحتاج 0.3 ثانية على الأقل بين البداية والنهاية.';return}
  stop();
  rows.forEach((row,i)=>{scenes[i].duration=(row.end-row.start)*(scenes[i].speed||1)});
  time=0;refresh();queueSave();
  el('msg').textContent='ضُبطت مدد '+rows.length+' مشاهد على التسجيل.';
  close();
 };
 el('syncCancel').onclick=close;
 dialog.addEventListener('cancel',stopPlayer);
 dialog.addEventListener('close',stopPlayer);

 opener.onclick=()=>{
  if(!soundBuffer||scenes.length<2||loading||recording)return;
  stop();
  // الحدود الابتدائية توزع مدد المشاهد الحالية على زمن التسجيل نفسه،
  // فيقرأ المستخدم ثواني حقيقية على التسجيل حتى لو كان الفيديو أطول أو أقصر.
  const scale=soundBuffer.duration/Math.max(0.1,total());
  let at=0;
  rows=scenes.map(scene=>{const span=sceneSeconds(scene)*scale,row={start:at,end:at+span};at+=span;return row});
  renderRows();refreshDurations();
  el('syncState').textContent='';
  dialog.showModal();
  stopPlayer();
  if(soundAsset?.blob){
   playerUrl=URL.createObjectURL(soundAsset.blob);
   player=new Audio(playerUrl);
   player.addEventListener('ended',()=>{el('syncPlay').textContent='▶︎'});
   tick();
  }else el('syncState').textContent='التسجيل غير جاهز للتشغيل.';
 };
})();
