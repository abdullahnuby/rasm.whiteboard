'use strict';
let handImage=null,handData=null,handTip={x:5,y:88},removedScenes=[];
function clearRemoved(){removedScenes=[];el('undoRemove').disabled=true}
el('undoRemove').onclick=()=>{const last=removedScenes.pop();if(!last)return;const i=Math.min(last.at,scenes.length);scenes.splice(i,0,last.scene);pick(i);el('undoRemove').disabled=!removedScenes.length;queueSave()};
el('handFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;stop();busy(true);try{const data=await asData(f);if(!data.startsWith('data:image/png;'))throw Error();const im=new Image();im.src=data;await im.decode();handImage=im;handData=data;el('useHand').disabled=false;if(scenes[selected])scenes[selected].tone=3;refresh();queueSave()}catch{el('msg').textContent='اختار صورة يد PNG بخلفية شفافة.'}finally{busy(false);e.target.value=''}};
el('useHand').onclick=()=>{if(handImage&&scenes[selected]){scenes[selected].tone=3;refresh();queueSave()}};
for(const [id,key] of [['tipX','x'],['tipY','y']])el(id).onchange=()=>{handTip[key]=within(+el(id).value,0,100,0);el(id).value=handTip[key];render(time);queueSave()};
const projectDialog=el('projectDialog');
let soundBuffer=null,audioContext=null,audioSource=null,recordBus=null,soundAsset=null;
let restoring=true,timer,db,saveRevision=0,title='مشروع الوايت بورد';
const within=(v,min,max,fallback)=>Number.isFinite(v)?Math.min(max,Math.max(min,v)):fallback;
const choose=(v,list,fallback)=>list.includes(v)?v:fallback;
const asData=file=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(r.error);r.readAsDataURL(file)});
function audioEngine(){return audioContext??=new (window.AudioContext||window.webkitAudioContext)()}
async function readySound(){if(soundBuffer)await audioEngine().resume()}
function stopSound(){if(audioSource){try{audioSource.stop()}catch{}audioSource.disconnect();audioSource=null}}
function startSound(at){if(!soundBuffer||at>=soundBuffer.duration)return;const c=audioEngine();audioSource=c.createBufferSource();audioSource.buffer=soundBuffer;audioSource.connect(c.destination);if(recordBus)audioSource.connect(recordBus);audioSource.start(0,at)}
function showAudio(){el('audioInfo').textContent=soundAsset?soundAsset.name+' · '+soundBuffer.duration.toFixed(1)+' ث': 'مفيش تسجيل مضاف';el('audioClear').hidden=!soundAsset;el('audioPick').textContent=soundAsset?'تغيير التسجيل':'إضافة تسجيل'}
el('audioPick').onclick=()=>el('soundFile').click();
function isAudioFile(file){return file.type.startsWith('audio/')||/\.(mp3|m4a|aac|wav|ogg|flac|opus|weba)$/i.test(file.name)}
async function attachRecording(file){
 if(!file||recording||loading)return;
 stop();busy(true);el('msg').textContent='جاري تجهيز التسجيل…';
 try{
  const decoded=await audioEngine().decodeAudioData(await file.arrayBuffer());
  const data=await asData(file);
  soundBuffer=decoded;soundAsset={name:file.name,data};showAudio();queueSave();
  el('msg').textContent='تمت إضافة التسجيل · '+decoded.duration.toFixed(1)+' ثانية';
 }catch{el('msg').textContent='تعذّر فتح التسجيل. جرّب نسخة MP3 أو WAV محفوظة في تطبيق الملفات.'}
 finally{busy(false)}
}
async function importMedia(items){
 if(loading||recording)return;
 const audio=items.filter(isAudioFile),images=items.filter(f=>!isAudioFile(f));
 if(images.length)await importFiles(images);
 if(audio.length===1)await attachRecording(audio[0]);
 if(audio.length>1)el('msg').textContent='اختار تسجيل صوتي واحد لمسار التعليق.';
}
el('soundFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';await attachRecording(file)};
el('audioClear').onclick=()=>{stop();soundAsset=soundBuffer=null;showAudio();queueSave()};
el('play').onclick=async()=>{if(running)return stop();try{await readySound();if(time>=total()-.001)time=0;run()}catch{el('msg').textContent='تعذّر تشغيل الصوت.'}};
el('copy').onclick=()=>{if(!scenes.length)return;let clone={...scenes[selected],name:scenes[selected].name+' (نسخة)'};scenes.splice(selected+1,0,clone);pick(selected+1);queueSave()};
function busy(flag){loading=flag;document.querySelector('.grid').inert=flag;document.querySelector('.intro').inert=flag;el('export').disabled=flag||!scenes.length;el('projectMenu').disabled=flag}
function setTitle(value){title=String(value||'مشروع الوايت بورد').trim().slice(0,100)||'مشروع الوايت بورد';el('titleView').textContent=el('projectName').value=title}
el('projectName').onchange=e=>{setTitle(e.target.value);queueSave()};
el('projectMenu').onclick=()=>{if(recording||loading)return;stop();projectDialog.showModal()};
function snapshot(){return {format:'rasm-studio',version:3,title,demo,ratio:el('ratio').value,quality:el('quality').value,selected,hand:handData,tip:handTip,audio:soundAsset,scenes:scenes.map(s=>{
 const {name,duration,speed,mode,tone,side,hold,paper,transition,sourceHand,handSize,weight,zones}=s;
 return {name,duration,speed,mode,tone,side,hold,paper,transition,sourceHand,handSize,weight,zones,image:s.asset??=s.src.toDataURL('image/png')};
 })}}
function dbRequest(req){return new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)})}
async function save(revision){if(restoring||!db)return;try{const data=snapshot(),tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(data,'current');await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onabort=tx.onerror=no});if(revision===saveRevision)el('saveState').textContent='محفوظ على الجهاز'}catch{el('saveState').textContent='تعذّر الحفظ المحلي · نزّل نسخة من ملف المشروع'}}
function queueSave(){if(restoring)return;el('saveState').textContent='جاري حفظ التعديلات…';clearTimeout(timer);const revision=++saveRevision;timer=setTimeout(()=>save(revision),220)}
if(!window.indexedDB)el('saveState').textContent='الحفظ المحلي غير متاح';
const persistedInputs=new Set(['sourceHand','handSize','weight','ratio','quality','side','hold','paper','transition','duration','sceneName','style']);
document.addEventListener('change',e=>{if(persistedInputs.has(e.target.id))queueSave()});
document.addEventListener('click',e=>{if(e.target.closest('#hands, #earlier, #later, #remove'))queueSave()});
el('backup').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot())],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=title+'.rasm';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)};
el('restore').onclick=()=>el('projectInput').click();
async function readProject(p){
 if(p?.format!=='rasm-studio'||![2,3].includes(p.version)||!Array.isArray(p.scenes))throw Error('format');
 const restored=[];
 for(const row of p.scenes){
 if(!/^data:image\/(png|jpeg|webp);base64,/i.test(row?.image))throw Error('image');
 const img=new Image();img.src=row.image;await img.decode();
 const s=analyze(img,String(row.name||'مشهد').slice(0,120));Object.assign(s,{asset:row.image,speed:choose(row.speed,[.25,.5,.75,1],1),sourceHand:choose(row.sourceHand,['auto','detect','present','clean'],'auto'),weight:choose(row.weight,[1,1.4,2.3],1.4),handSize:within(row.handSize,55,160,100),zones:Array.isArray(row.zones)?row.zones.filter(z=>z&&['x','y','w','h'].every(k=>Number.isFinite(z[k])&&z[k]>=0&&z[k]<=1)).slice(0,80):[],duration:within(row.duration,1,120,6),hold:within(row.hold,0,70,18),side:choose(row.side,['1','-1'],'1'),tone:choose(row.tone,p.hand?[0,1,2,3,4]:[0,1,2,4],4),mode:choose(row.mode,['original','ink','color','fill'],'original'),paper:/^#[a-f0-9]{6}$/i.test(row.paper)?row.paper:'#ffffff',transition:choose(row.transition,['cut','fade'],'cut')});applyZones(s);restored.push(s)}
 let audio=null;
 if(p.audio){if(typeof p.audio.data!=='string'||!/^data:[^,]*;base64,/i.test(p.audio.data))throw Error('audio');audio=await audioEngine().decodeAudioData(await (await fetch(p.audio.data)).arrayBuffer())}
 let custom=null;if(p.hand){if(!/^data:image\/png;base64,/i.test(p.hand))throw Error('hand');custom=new Image();custom.src=p.hand;await custom.decode()}
 stop();clearRemoved();handImage=custom;handData=p.hand||null;handTip={x:within(p.tip?.x,0,100,5),y:within(p.tip?.y,0,100,88)};el('tipX').value=handTip.x;el('tipY').value=handTip.y;el('useHand').disabled=!custom;scenes=restored;demo=p.demo===true;soundBuffer=audio;soundAsset=p.audio||null;el('ratio').value=choose(p.ratio,['1.7777778','.5625','1'],'1.7777778');el('quality').value=choose(p.quality,['1280','1920'],'1280');setTitle(p.title);showAudio();selected=Math.floor(within(p.selected,0,Math.max(0,scenes.length-1),0));time=scenes.length?offset(selected)+sceneSeconds(scenes[selected])*.7:0;cache={};size();refresh()
}
el('projectInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;projectDialog.close();busy(true);try{await readProject(JSON.parse(await file.text()));queueSave();el('msg').textContent='تم فتح نسخة المشروع.'}catch{el('msg').textContent='تعذّر قراءة النسخة. المشروع الحالي ما زال مفتوح.'}finally{busy(false);e.target.value=''}};
(async()=>{busy(true);setTitle(title);try{const req=indexedDB.open('rasm-studio',1);req.onupgradeneeded=()=>req.result.createObjectStore('projects');db=await dbRequest(req);const last=await dbRequest(db.transaction('projects').objectStore('projects').get('current'));if(last)await readProject(last);el('saveState').textContent=last?'تم استرجاع المشروع المحفوظ':'مشروع تجريبي · أضف صورك للبدء'}catch{el('saveState').textContent='تعذّر استرجاع الحفظ المحلي · استخدم ملف المشروع'}finally{restoring=false;busy(false)}})();
