'use strict';
const panels=['scene','timing','hand','video'];
function choosePanel(active){
 for(const key of panels){el('pane-'+key).hidden=key!==active;el('open-'+key).setAttribute('aria-pressed',String(key===active))}
}
for(const key of panels)el('open-'+key).onclick=()=>choosePanel(key);
el('startImport').onclick=el('emptyImport').onclick=el('flowImages').onclick=()=>files.click();
el('flowAudio').onclick=()=>el('soundFile').click();
el('flowPreview').onclick=()=>{if(scenes.length)el('play').click()};
function refreshGuide(){
 const hasScenes=scenes.length>0;
 el('startGuide').hidden=hasScenes;
 el('emptyBoard').hidden=hasScenes;board.hidden=!hasScenes;
 el('stepImages').textContent=hasScenes?scenes.length+' مشاهد':'ابدأ هنا';
 const audio=typeof soundBuffer!=='undefined'?soundBuffer:null;
 el('stepAudio').textContent=audio?audio.duration.toFixed(1)+' ثانية':'اختياري';
 el('stepPreview').textContent=hasScenes?total().toFixed(1)+' ثانية':'أضف صورك أولًا';
 el('flowPreview').disabled=!hasScenes;
 el('fitAudio').hidden=!audio||!hasScenes;
 el('audioMatch').textContent=audio&&hasScenes?(
 Math.abs(audio.duration-total())>.3?'التسجيل '+audio.duration.toFixed(1)+' ث · الفيديو '+total().toFixed(1)+' ث':'مدة الفيديو مطابقة للتسجيل'):'';
 for(const id of ['copy','zoneEdit','allSpeed','allOriginal'])el(id).disabled=!hasScenes;
 syncDrawer();
 el('inspectorTitle').textContent=hasScenes?'خصائص المشهد '+(selected+1):'إعدادات المشروع'
}
el('fitAudio').onclick=()=>{
 if(!soundBuffer||!scenes.length)return;
 const durations=scenes.map(s=>sceneSeconds(s)/total()*soundBuffer.duration);
 if(durations.some(d=>d<1||d>180)){el('msg').textContent='اضبط عدد المشاهد ليكون نصيب كل مشهد بين ثانية و180 ثانية.';return}
 stop();scenes.forEach((s,i)=>s.duration=durations[i]*(s.speed||1));time=0;refresh();queueSave()
};
el('sampleProject').onclick=async()=>{
 if(loading||recording)return;
 stop();busy(true);setOperationStatus('تجهيز المشروع التجريبي…',0,3);
 try{
  const examples=[],names=['الفكرة الأساسية','بناء التفاصيل','المشهد النهائي'];
  for(let i=0;i<names.length;i++){
   const scene=await RasmImageEngine.analyzeAsync(house(i),names[i]);
   await applyZones(scene);examples.push(scene);setOperationStatus('تجهيز المشروع التجريبي…',i+1,names.length)
  }
  scenes=examples;demo=true;selected=0;time=0;cache={};clearRemoved();
  prewarmColorSchedules(scenes);refresh();el('zoomFit').click();queueSave();el('msg').textContent='المشروع التجريبي جاهز للمعاينة.'
 }catch(error){el('msg').textContent='تعذّر تجهيز المثال: '+String(error?.message||error)}
 finally{clearOperationStatus();busy(false)}
};

document.addEventListener('keydown',e=>{
 if(e.code!=='Space'||e.target.matches('input,select,textarea,button')||document.querySelector('dialog[open]')||recording||loading||!scenes.length)return;
 e.preventDefault();el('play').click()
});
refreshGuide();

el('newProject').onclick=async()=>{
 if(loading||recording)return;
 stop();projectDialog.close();busy(true);
 clearTimeout(timer);saveRevision++;
 try{
  if(scenes.length||soundAsset){
   if(!db)throw Error('الحفظ المحلي غير متاح. نزّل نسخة من المشروع الحالي قبل البدء من جديد.');
   const previous=await snapshot(false);
   await saveQueue(()=>repository.put('recovered-'+Date.now(),previous))
  }
  scenes=[];selected=0;time=0;demo=true;soundBuffer=null;soundAsset=null;cache={};clearRemoved();
  setTitle('مشروع وايت بورد');showAudio();refresh();choosePanel('scene');queueSave();
  el('exportPanel').hidden=true;el('download').hidden=true;el('msg').textContent='مشروع جديد جاهز. مشروعاتك السابقة متاحة من إدارة المشروع.';
 }catch(error){el('msg').textContent=String(error.message||error)}
 finally{busy(false)}
};


// Reuse one inspector node, so mobile and desktop always edit the same controls.
const mobileLayout=window.matchMedia('(max-width: 900px)');
const inspectorNode=el('inspector'),drawer=el('mobileDrawer');
const inspectorAnchor=document.createComment('Inspector desktop position');
inspectorNode.before(inspectorAnchor);
let drawerOpener=null;
function syncDrawer(){
 el('drawerProjectName').textContent=el('titleView').textContent;
 const blocked=loading||recording;
 el('mobileMenu').disabled=blocked;
 el('editSceneMobile').disabled=blocked||!scenes.length;
 el('drawerExport').disabled=blocked||!scenes.length;
 el('exportDownload').hidden=el('download').hidden||blocked;
 for(const id of ['drawerProject','drawerImport','drawerAudio','drawerExportOptions'])el(id).disabled=blocked;
}
function closeDrawer(){
 el('mobileMenu').setAttribute('aria-expanded','false');
 document.documentElement.classList.remove('sidebar-open');
 if(drawer.open)drawer.close()
}
function openDrawer(panel,opener=el('mobileMenu')){
 if(!mobileLayout.matches||loading||recording)return;
 stop();drawerOpener=opener;syncDrawer();
 if(panel)choosePanel(panel);
 if(!drawer.open)drawer.showModal();
 el('mobileMenu').setAttribute('aria-expanded','true');
 document.documentElement.classList.add('sidebar-open')
}
drawer.addEventListener('close',()=>{
 el('mobileMenu').setAttribute('aria-expanded','false');
 document.documentElement.classList.remove('sidebar-open');
 if(mobileLayout.matches)drawerOpener?.focus({preventScroll:true})
});
drawer.addEventListener('click',event=>{
 if(event.target!==drawer)return;
 const bounds=drawer.getBoundingClientRect();
 if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeDrawer()
});
function moveInspector(){
 closeDrawer();
 if(mobileLayout.matches)el('drawerContent').append(inspectorNode);
 else inspectorAnchor.after(inspectorNode);
 syncDrawer()
}
mobileLayout.addEventListener('change',moveInspector);
el('mobileMenu').onclick=()=>openDrawer(null);
el('editSceneMobile').onclick=()=>openDrawer('scene',el('editSceneMobile'));
el('drawerClose').onclick=el('drawerDone').onclick=closeDrawer;
el('drawerProject').onclick=()=>{closeDrawer();el('projectMenu').click()};
el('drawerImport').onclick=()=>{closeDrawer();files.click()};
el('drawerAudio').onclick=()=>{closeDrawer();el('soundFile').click()};
el('drawerExportOptions').onclick=()=>choosePanel('video');
el('drawerExport').onclick=()=>{closeDrawer();el('export').click()};
moveInspector();

el('exportDownload').onclick=()=>el('download').click();
