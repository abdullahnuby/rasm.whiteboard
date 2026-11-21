'use strict';
let handImage=null,handData=null,handTip={x:5,y:88},removedScenes=[];
function clearRemoved(){removedScenes=[];el('undoRemove').disabled=true}
el('undoRemove').onclick=()=>{const last=removedScenes.pop();if(!last)return;const i=Math.min(last.at,scenes.length);scenes.splice(i,0,last.scene);pick(i);el('undoRemove').disabled=!removedScenes.length;queueSave()};
el('handFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;stop();busy(true);try{const data=await asData(f);if(!data.startsWith('data:image/png;'))throw Error();const im=new Image();im.src=data;await im.decode();handImage=im;handData=data;el('useHand').disabled=false;if(scenes[selected])scenes[selected].tone=3;refresh();queueSave()}catch{el('msg').textContent='اختر صورة PNG لليد بخلفية شفافة.'}finally{busy(false);e.target.value=''}};
el('useHand').onclick=()=>{if(handImage&&scenes[selected]){scenes[selected].tone=3;refresh();queueSave()}};
for(const [id,key] of [['tipX','x'],['tipY','y']])el(id).onchange=()=>{handTip[key]=within(+el(id).value,0,100,0);el(id).value=handTip[key];render(time);queueSave()};
const projectDialog=el('projectDialog');
let soundBuffer=null,audioContext=null,audioSource=null,recordBus=null,soundAsset=null;
let restoring=true,timer,db,saveRevision=0,title='مشروع وايت بورد';
const saveQueue=RasmReliability.createSerialQueue();
const within=(v,min,max,fallback)=>Number.isFinite(v)?Math.min(max,Math.max(min,v)):fallback;
const choose=(v,list,fallback)=>list.includes(v)?v:fallback;
const asData=file=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(r.error);r.readAsDataURL(file)});
function audioEngine(){return audioContext??=new (window.AudioContext||window.webkitAudioContext)()}
async function readySound(){if(soundBuffer)await audioEngine().resume()}
function stopSound(){if(audioSource){try{audioSource.stop()}catch{}audioSource.disconnect();audioSource=null}}
function startSound(at){if(!soundBuffer||at>=soundBuffer.duration)return;const c=audioEngine();audioSource=c.createBufferSource();audioSource.buffer=soundBuffer;audioSource.connect(c.destination);if(recordBus)audioSource.connect(recordBus);audioSource.start(0,at)}
function showAudio(){if(typeof refreshGuide==='function')refreshGuide();el('audioInfo').textContent=soundAsset?soundAsset.name+' · '+soundBuffer.duration.toFixed(1)+' ث': 'لم يُضف تسجيل بعد';el('audioClear').hidden=!soundAsset;el('audioPick').textContent=soundAsset?'تغيير التسجيل':'إضافة تسجيل';setAudioTimeline(soundBuffer?.duration||0,soundAsset?.name,soundBuffer)}
el('audioPick').onclick=()=>el('soundFile').click();
function isAudioFile(file){return file.type.startsWith('audio/')||/\.(mp3|m4a|aac|wav|ogg|flac|opus|weba)$/i.test(file.name)}
const MAX_AUDIO_BYTES=80*1048576;
async function attachRecording(file){
 if(!file||recording||loading)return;
 if(file.size>MAX_AUDIO_BYTES){el('msg').textContent='ملف الصوت أكبر من 80 ميجابايت. قسّمه أو اضغطه.';return}
 stop();busy(true);setOperationStatus('جارٍ فك ترميز التسجيل الصوتي',0,1);el('msg').textContent='جارٍ تجهيز التسجيل…';
 try{
  const decoded=await audioEngine().decodeAudioData(await file.arrayBuffer());
  soundBuffer=decoded;soundAsset={name:String(file.name).slice(0,200),blob:file};showAudio();setOperationStatus('تم تجهيز التسجيل الصوتي',1,1);queueSave();
  el('msg').textContent='تمت إضافة التسجيل · '+decoded.duration.toFixed(1)+' ثانية';
 }catch{el('msg').textContent='تعذّر فتح التسجيل. جرّب نسخة MP3 أو WAV محفوظة في تطبيق الملفات.'}
 finally{busy(false);clearOperationStatus()}
}
async function importMedia(items){
 if(loading||recording)return;
 const audio=items.filter(isAudioFile),images=items.filter(f=>!isAudioFile(f));
 if(images.length)await importFiles(images);
 if(audio.length===1)await attachRecording(audio[0]);
 if(audio.length>1)el('msg').textContent='اختر ملفًا صوتيًا واحدًا لمسار التعليق.';
}
el('soundFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';await attachRecording(file)};
el('audioClear').onclick=()=>{stop();soundAsset=soundBuffer=null;showAudio();queueSave()};
el('play').onclick=async()=>{if(running)return stop();try{await readySound();if(time>=total()-.001)time=0;run()}catch{el('msg').textContent='تعذّر تشغيل الصوت.'}};
el('copy').onclick=()=>{if(!scenes.length)return;let clone={...scenes[selected],name:scenes[selected].name+' (نسخة)'};scenes.splice(selected+1,0,clone);pick(selected+1);queueSave()};
function busy(flag){loading=flag;document.querySelector('.workflow').inert=flag;document.querySelector('.grid').inert=flag;document.querySelector('.intro').inert=flag;el('export').disabled=flag||!scenes.length;el('projectMenu').disabled=flag;if(typeof syncDrawer==='function')syncDrawer()}
function setTitle(value){title=String(value||'مشروع وايت بورد').trim().slice(0,100)||'مشروع وايت بورد';el('titleView').textContent=el('projectName').value=title}
el('projectName').onchange=e=>{setTitle(e.target.value);queueSave()};
el('projectMenu').onclick=()=>{if(recording||loading)return;stop();projectDialog.showModal();listRecovered()};
const canvasBlob=c=>new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(Error('blob')),'image/png'));
const asUrl=x=>typeof x==='string'?Promise.resolve(x):asData(x);
// Settings are copied synchronously so edits made while images encode cannot tear the snapshot.
// Images and audio stay Blobs for IndexedDB (no base64 bloat, no main-thread PNG encoding); the .rasm file gets data URLs.
async function snapshot(forFile){
 const rows=scenes.map(s=>{const {name,duration,speed,motionStyle,shapeSequence,mode,tone,side,hold,paper,transition,sourceHand,handSize,weight}=s;return {scene:s,row:{name,duration,speed,motionStyle,shapeSequence,mode,tone,side,hold,paper,transition,sourceHand,handSize,weight,zones:s.zones.map(z=>({...z}))}}});
 const head={format:'rasm-studio',version:3,title,demo,ratio:el('ratio').value,quality:el('quality').value,exportFormat:el('exportFormat').value,exportEngine:el('exportEngine').value,selected,hand:handData,tip:handTip};
 const sound=soundAsset;
 for(const item of rows){const s=item.scene;if(!s.asset)s.asset=await canvasBlob(s.src);item.row.image=forFile?await asUrl(s.asset):s.asset}
 head.audio=sound?{name:sound.name,...(forFile?{data:sound.data??await asData(sound.blob)}:sound.blob?{blob:sound.blob}:{data:sound.data})}:null;
 return {...head,scenes:rows.map(i=>i.row)}
}
function dbRequest(req){return new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)})}
let askedPersist=false;
async function save(revision){
 return saveQueue(async()=>{
  if(restoring||!db||revision!==saveRevision)return;
  try{
   const data=await snapshot(false);
   if(restoring||!db||revision!==saveRevision)return;
   const tx=db.transaction('projects','readwrite');
   tx.objectStore('projects').put(data,'current');
   await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onabort=tx.onerror=()=>no(tx.error||Error('IndexedDB write failed'))});
   if(revision===saveRevision)el('saveState').textContent='محفوظ في هذا المتصفح';
   if(!askedPersist){askedPersist=true;navigator.storage?.persist?.().catch(()=>{})}
  }catch{
   if(revision===saveRevision)el('saveState').textContent='تعذّر الحفظ المحلي · نزّل نسخة من ملف المشروع';
  }
 });
}
function queueSave(){if(restoring)return;el('saveState').textContent='جارٍ حفظ التعديلات…';clearTimeout(timer);const revision=++saveRevision;if(lastUrl&&lastExportRevision!==null&&revision>lastExportRevision)el('exportLabel').textContent='فيديو سابق · أعد التصدير لتضمين التعديلات';timer=setTimeout(()=>save(revision),220)}
if(!window.indexedDB)el('saveState').textContent='الحفظ المحلي غير متاح';
const persistedInputs=new Set(['exportFormat','exportEngine','sourceHand','handSize','weight','ratio','quality','side','hold','paper','transition','duration','sceneName','style','motionStyle']);
document.addEventListener('change',e=>{if(persistedInputs.has(e.target.id))queueSave()});
document.addEventListener('click',e=>{if(e.target.closest('#hands, #earlier, #later, #remove'))queueSave()});
async function downloadProjectData(data,fileName){
 const copy={...data,scenes:[]};
 for(let i=0;i<(data.scenes||[]).length;i++){
  const row=data.scenes[i],image=row.image instanceof Blob?await asData(row.image):row.image;
  copy.scenes.push({...row,image});setOperationStatus('تجهيز الصور في النسخة الاحتياطية',i+1,data.scenes.length);
 }
 if(data.audio){
  setOperationStatus('تجهيز تسجيل المشروع',0,1);
  const audioData=data.audio.blob instanceof Blob?await asData(data.audio.blob):data.audio.data;
  copy.audio={name:String(data.audio.name||'تسجيل').slice(0,200),data:audioData};setOperationStatus('تجهيز تسجيل المشروع',1,1);
 }
 const blob=new Blob([JSON.stringify(copy)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=(String(fileName||data.title||'مشروع وايت بورد').replace(/[\\/:*?"<>|]+/g,'-').slice(0,100)||'مشروع')+'.rasm';
 a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
el('backup').onclick=async()=>{
 if(recording||loading)return;
 projectDialog.close();busy(true);setOperationStatus('تجهيز نسخة المشروع',0,Math.max(1,scenes.length));
 try{await downloadProjectData(await snapshot(false),title)}
 catch{clearOperationStatus();el('msg').textContent='تعذّر تجهيز نسخة المشروع.'}
 finally{busy(false)}
};
el('restore').onclick=()=>el('projectInput').click();
async function recoveredRecords(){
 if(!db)return [];
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('projects','readonly'),request=tx.objectStore('projects').openCursor(),items=[];
  request.onerror=()=>reject(request.error||Error('Unable to read recovery records'));
  request.onsuccess=()=>{
   const cursor=request.result;
   if(!cursor){resolve(items);return}
   if(typeof cursor.key==='string'&&cursor.key.startsWith('recovered-'))items.push({key:cursor.key,value:cursor.value});
   cursor.continue();
  };
 });
}
async function listRecovered(){
 const section=el('recoverySection'),container=el('recoveredItems');
 container.replaceChildren();section.hidden=true;
 if(!db)return;
 try{
  const items=await recoveredRecords();
  if(!items.length)return;
  section.hidden=false;
  for(const item of items){
   const row=document.createElement('div');row.className='recoveredItem';
   const name=document.createElement('strong');name.className='recoveredName';
   name.textContent=(item.value?.title||'مشروع مسترد')+' · '+new Date(Number(item.key.slice(10))).toLocaleString('ar-EG');
   const open=document.createElement('button');open.className='recoverOpen';open.textContent='فتح المشروع';
   open.onclick=async()=>{
    projectDialog.close();busy(true);
    try{await readProject(item.value);queueSave();projectDialog.close();el('msg').textContent='تم فتح النسخة المستردة.'}
    catch{clearOperationStatus();el('msg').textContent='لم تنجح استعادة هذه النسخة. ما زالت محفوظة ويمكن تنزيلها.'}
    finally{busy(false)}
   };
   const download=document.createElement('button');download.textContent='تنزيل النسخة';
   download.onclick=async()=>{
    projectDialog.close();busy(true);
    try{await downloadProjectData(item.value,item.value?.title||item.key);el('msg').textContent='تم تجهيز نسخة الاسترداد للتنزيل.'}
    catch{clearOperationStatus();el('msg').textContent='تعذّر تجهيز ملف الاسترداد.'}
    finally{busy(false)}
   };
   const remove=document.createElement('button');remove.textContent='حذف النسخة';
   remove.onclick=async()=>{
    if(!confirm('حذف نسخة الاسترداد هذه نهائيًا؟'))return;
    try{
     const tx=db.transaction('projects','readwrite');tx.objectStore('projects').delete(item.key);
     await new Promise((ok,no)=>{tx.oncomplete=ok;tx.onabort=tx.onerror=()=>no(tx.error||Error('Delete failed'))});
     await listRecovered();
    }catch{el('msg').textContent='تعذّر حذف نسخة الاسترداد.'}
   };
   row.append(name,open,download,remove);container.append(row);
  }
 }catch{section.hidden=false;const note=document.createElement('p');note.className='recoveryEmpty';note.textContent='تعذّر قراءة قائمة النسخ المستردة.';container.append(note)}
}

async function readProject(p){
 if(p?.format!=='rasm-studio'||![2,3].includes(p.version)||!Array.isArray(p.scenes)||p.scenes.length>300)throw Error('format-or-scene-limit');
 const restored=[];let totalPixels=0;
 setOperationStatus('إعادة تحليل مشاهد المشروع',0,p.scenes.length);
 for(let sceneIndex=0;sceneIndex<p.scenes.length;sceneIndex++){
  const row=p.scenes[sceneIndex];
  const blobImage=row?.image instanceof Blob&&/^image\/(png|jpeg|webp)$/.test(row.image.type);
  if(!blobImage&&!/^data:image\/(png|jpeg|webp);base64,/i.test(row?.image))throw Error('image');
  if(blobImage&&row.image.size>MAX_IMAGE_BYTES)throw Error('image-size');
  if(typeof row.image==='string'&&row.image.length>MAX_IMAGE_BYTES*1.42)throw Error('image-size');
  const imageUrl=blobImage?URL.createObjectURL(row.image):row.image;let s;
  try{
   const img=new Image();img.src=imageUrl;await img.decode();
   const fitted=RasmReliability.fitDimensions(img.naturalWidth||img.width,img.naturalHeight||img.height,960,720);
   if(!fitted||!RasmReliability.withinPixelBudget(totalPixels,fitted.pixels,MAX_PROJECT_PIXELS))throw Error('project-pixel-limit');
   totalPixels+=fitted.pixels;
   s=await RasmImageEngine.analyzeAsync(img,String(row.name||'مشهد').slice(0,120));
  }finally{if(blobImage)URL.revokeObjectURL(imageUrl)}
  Object.assign(s,{
   asset:row.image,
   speed:choose(row.speed,[.1,.15,.2,.25,.35,.5,.75,1],1),
   motionStyle:choose(row.motionStyle,['smart','contour'],'smart'),
   shapeSequence:choose(row.shapeSequence,['smart','strokes'],'smart'),
   sourceHand:choose(row.sourceHand,['auto','detect','present','clean'],'auto'),
   weight:choose(row.weight,[1,1.4,2.3],1.4),
   handSize:within(row.handSize,55,160,100),
   zones:Array.isArray(row.zones)?row.zones.filter(z=>z&&['x','y','w','h'].every(k=>Number.isFinite(z[k])&&z[k]>=0&&z[k]<=1)).slice(0,80):[],
   duration:within(row.duration,.1,180,6),
   hold:within(row.hold,0,70,18),
   side:choose(row.side,['1','-1'],'1'),
   tone:choose(row.tone,p.hand?[0,1,2,3,4]:[0,1,2,4],4),
   mode:choose(row.mode,['original','ink','color','fill'],'original'),
   paper:/^#[a-f0-9]{6}$/i.test(row.paper)?row.paper:'#ffffff',
   transition:choose(row.transition,['cut','fade'],'cut')
  });
  applyZones(s);restored.push(s);setOperationStatus('إعادة تحليل المشاهد · '+(sceneIndex+1)+' / '+p.scenes.length,sceneIndex+1,p.scenes.length);
 }
 let audio=null;
 if(p.audio){
  setOperationStatus('فك ترميز التسجيل الصوتي',0,1);
  if(p.audio.blob instanceof Blob){
   if(p.audio.blob.size>MAX_AUDIO_BYTES)throw Error('audio-size');
   audio=await audioEngine().decodeAudioData(await p.audio.blob.arrayBuffer());
  }else{
   if(typeof p.audio.data!=='string'||!/^data:[^,]*;base64,/i.test(p.audio.data)||p.audio.data.length>MAX_AUDIO_BYTES*1.42)throw Error('audio');
   audio=await audioEngine().decodeAudioData(await (await fetch(p.audio.data)).arrayBuffer());
  }
  setOperationStatus('تم فك ترميز التسجيل الصوتي',1,1);
 }
 let custom=null;
 if(p.hand){
  if(!/^data:image\/png;base64,/i.test(p.hand))throw Error('hand');
  custom=new Image();custom.src=p.hand;await custom.decode();
 }
 clearOperationStatus();stop();clearRemoved();handImage=custom;handData=p.hand||null;
 handTip={x:within(p.tip?.x,0,100,5),y:within(p.tip?.y,0,100,88)};
 el('tipX').value=handTip.x;el('tipY').value=handTip.y;el('useHand').disabled=!custom;
 scenes=restored;prewarmColorSchedules(restored);demo=p.demo===true;soundBuffer=audio;
 soundAsset=p.audio?{name:String(p.audio.name||'تسجيل').slice(0,200),...(p.audio.blob instanceof Blob?{blob:p.audio.blob}:{data:p.audio.data})}:null;
 el('ratio').value=choose(p.ratio,['1.7777778','.5625','1'],'1.7777778');
 el('quality').value=choose(p.quality,['1280','1920'],'1280');el('exportFormat').value=choose(p.exportFormat,['auto','mp4','webm'],'auto');el('exportEngine').value=choose(p.exportEngine,['auto','live'],'auto');
 setTitle(p.title);showAudio();
 selected=Math.floor(within(p.selected,0,Math.max(0,scenes.length-1),0));
 time=scenes.length?offset(selected)+sceneSeconds(scenes[selected])*.7:0;
 cache={};size();refresh();
}
el('projectInput').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 if(file.size>300*1048576){el('msg').textContent='ملف المشروع أكبر من 300 ميجابايت.';e.target.value='';return}
 projectDialog.close();busy(true);
 try{await readProject(JSON.parse(await file.text()));queueSave();el('msg').textContent='تم فتح نسخة المشروع.'}
 catch{el('msg').textContent='تعذّر قراءة النسخة. المشروع الحالي ما زال مفتوح.'}
 finally{busy(false);e.target.value=''}
};
(async()=>{busy(true);setTitle(title);try{const req=indexedDB.open('rasm-studio',1);req.onupgradeneeded=()=>req.result.createObjectStore('projects');db=await dbRequest(req);const last=await dbRequest(db.transaction('projects').objectStore('projects').get('current'));if(last){try{await readProject(last)}catch(error){clearOperationStatus();const keep='recovered-'+Date.now();await dbRequest(db.transaction('projects','readwrite').objectStore('projects').put(last,keep));el('saveState').textContent='تعذّر فتح المشروع المحفوظ. اتحفظت نسخة منه ('+keep+') ولن تُمسح.';return}}el('saveState').textContent=last?'تم استرجاع المشروع المحفوظ':'ابدأ باستيراد صورك · الحفظ تلقائي'}catch{db=null;el('saveState').textContent='تعذّر استرجاع الحفظ المحلي · الحفظ التلقائي متوقف حتى لا يُمسح شغلك. استخدم ملف المشروع'}finally{restoring=false;busy(false)}})();
