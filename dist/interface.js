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
 el('syncAudio').hidden=!audio||!hasScenes||scenes.length<2;
 el('audioMatch').textContent=audio&&hasScenes?(
 Math.abs(audio.duration-total())>.3?'التسجيل '+audio.duration.toFixed(1)+' ث · الفيديو '+total().toFixed(1)+' ث':'مدة الفيديو مطابقة للتسجيل'):'';
 for(const id of ['copy','zoneEdit','allSpeed','allOriginal','allOutline'])el(id).disabled=!hasScenes;
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
 el('exportDownload').href=el('download').href;el('exportDownload').download=el('download').download;
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
 // The inspector now lives in the "المزيد" sheet on every screen size.
 closeDrawer();syncDrawer()
}
mobileLayout.addEventListener('change',moveInspector);
el('mobileMenu').onclick=()=>window.openSimplePop('more');
el('editSceneMobile').onclick=()=>window.openSimplePop('more');
el('drawerClose').onclick=el('drawerDone').onclick=closeDrawer;
el('drawerProject').onclick=()=>{closeDrawer();el('projectMenu').click()};
el('drawerImport').onclick=()=>{closeDrawer();files.click()};
el('drawerAudio').onclick=()=>{closeDrawer();el('soundFile').click()};
el('drawerExportOptions').onclick=()=>choosePanel('video');
el('drawerExport').onclick=()=>{closeDrawer();el('export').click()};
moveInspector();

// ضبط سريع من فوق المشهد نفسه: يعكس عناصر لوحة الخصائص ويرسل نفس أحداثها.
(()=>{
 const pairs=[['qSpeed','speed'],['qDuration','duration'],['qHandSize','handSize'],['qSide','side'],['qHold','hold']];
 el('qSpeed').innerHTML=el('speed').innerHTML;el('qSide').innerHTML=el('side').innerHTML;
 const sync=()=>{for(const [q,s] of pairs){const a=el(q),b=el(s);if(document.activeElement!==a)a.value=b.value;a.disabled=b.disabled}};
 for(const [q,s] of pairs){
  const fire=type=>{const b=el(s);b.value=el(q).value;b.dispatchEvent(new Event(type,{bubbles:true}))};
  el(q).addEventListener('input',()=>fire('input'));
  el(q).addEventListener('change',()=>fire('change'));
 }
 el('qSpeedAll').onclick=()=>el('allSpeed').click();
 const base=refresh;refresh=function(){const r=base.apply(this,arguments);sync();return r};
 sync();
})();

// اختيار المشهد من قائمة منسدلة بجوار المعاينة، مع السابق والتالي.
(()=>{
 const sel=el('sceneSelect'),prev=el('scenePrev'),next=el('sceneNext');
 let signature='';
 const sync=()=>{
  const sig=scenes.map(s=>s.name).join('\u0001');
  if(sig!==signature){signature=sig;sel.replaceChildren(...scenes.map((s,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(i+1)+'. '+(s.name||'مشهد '+(i+1));return o}))}
  sel.value=String(selected);sel.disabled=!scenes.length;prev.disabled=selected<=0;next.disabled=selected>=scenes.length-1;
 };
 sel.onchange=()=>pick(+sel.value);
 prev.onclick=()=>{if(selected>0)pick(selected-1)};
 next.onclick=()=>{if(selected<scenes.length-1)pick(selected+1)};
 const base=refresh;refresh=function(){const r=base.apply(this,arguments);sync();return r};
 sync();
})();


// ===== Simple main screen: a short bottom bar, each button opens one small sheet =====
(function(){
 const defs=[['speed','⚡','السرعة'],['hand','✋','اليد'],['elements','▦','المناطق'],['scenes','🎞','المشاهد'],['more','⚙','المزيد']];
 const ICONS={"speed": "<svg viewBox=\"0 0 24 24\"><path d=\"M13 2 4 14h7l-1 8 9-12h-7z\"/></svg>", "hand": "<svg viewBox=\"0 0 24 24\"><path d=\"M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4a1.5 1.5 0 0 1 3 0v6m0-4a1.5 1.5 0 0 1 3 0v6m0-2a1.5 1.5 0 0 1 3 0v4a8 8 0 0 1-8 8h-1a7 7 0 0 1-6-3.5L3 14a1.6 1.6 0 0 1 2.6-1.8L8 15\"/></svg>", "elements": "<svg viewBox=\"0 0 24 24\"><rect x=\"3\" y=\"3\" width=\"8\" height=\"8\" rx=\"2\"/><rect x=\"13\" y=\"3\" width=\"8\" height=\"8\" rx=\"2\"/><rect x=\"3\" y=\"13\" width=\"8\" height=\"8\" rx=\"2\"/><path d=\"M17 14v6m-3-3h6\"/></svg>", "scenes": "<svg viewBox=\"0 0 24 24\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"3\"/><path d=\"M8 5v14M16 5v14M3 10h5M3 14h5M16 10h5M16 14h5\"/></svg>", "more": "<svg viewBox=\"0 0 24 24\"><path d=\"M4 7h10m4 0h2M4 17h2m4 0h10\"/><circle cx=\"16\" cy=\"7\" r=\"2\"/><circle cx=\"8\" cy=\"17\" r=\"2\"/></svg>","add": "<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 8v8M8 12h8\"/></svg>"};
 const titles={speed:'السرعة والمدة',hand:'اليد',elements:'تحديد المناطق وترتيب الرسم',audio:'التعليق الصوتي',scenes:'المشاهد',more:'المزيد'};
 const bar=document.createElement('nav');bar.id='simpleBar';bar.setAttribute('aria-label','إعدادات سريعة');
 const addBar=document.createElement('button');addBar.type='button';addBar.id='barAdd';addBar.title='إضافة صور كمشاهد جديدة';
 addBar.innerHTML='<span aria-hidden="true">'+ICONS.add+'</span><b>إضافة صور</b>';
 addBar.onclick=()=>{close();el('files').click()};bar.append(addBar);
 el('sceneAddImages').onclick=()=>el('files').click();
 const pop=document.createElement('section');pop.id='simplePop';pop.hidden=true;pop.setAttribute('role','dialog');pop.setAttribute('aria-labelledby','popTitle');
 pop.innerHTML='<div class="popHead"><strong id="popTitle"></strong><button type="button" id="popClose" aria-label="إغلاق">إغلاق ✕</button></div><div class="popBody"></div>';
 const body=pop.querySelector('.popBody'),secs={};
 for(const [key,icon,label] of defs){
  const b=document.createElement('button');b.type='button';b.dataset.pop=key;b.setAttribute('aria-pressed','false');
  b.innerHTML='<span aria-hidden="true">'+ICONS[key]+'</span><b>'+label+'</b>';bar.append(b);
  const sec=document.createElement('div');sec.className='popSec';sec.dataset.sec=key;sec.hidden=true;body.append(sec);secs[key]=sec;
  b.onclick=()=>window.openSimplePop(pop.hidden||pop.dataset.open!==key?key:null)
 }
 const row=(...nodes)=>{const d=document.createElement('div');d.className='popRow';for(const n of nodes)d.append(n);return d};
 const lab=id=>el(id).closest('label');
 secs.speed.append(row(lab('qSpeed'),el('qSpeedAll')),row(lab('qDuration')),row(lab('qHold')));
 secs.hand.append(row(lab('qHandSize')),row(lab('qSide')));
 secs.elements.append(row(el('zoneEdit'),el('elementEdit')),row(lab('elementDirection')));
 const hint=document.createElement('small');hint.textContent='داخل مراجعة العناصر: «ترتيب سريع» يقسّم الصورة ويرتّبها تلقائيًا.';secs.elements.append(hint);
  const edit=document.querySelector('.edit'),list=[...document.querySelectorAll('details.sceneList')].find(d=>d.id!=='engineDiagnosticsPanel');
 list.open=true;
 const addInList=document.createElement('button');addInList.type='button';addInList.className='primary';addInList.textContent='＋ إضافة مشهد جديد';
 addInList.onclick=()=>{close();el('files').click()};
 secs.scenes.append(row(addInList),edit,list);
 secs.more.append(row(el('projectMenu'),el('storyOpen'),el('addFiles'),el('sampleProject')),row(el('appUpdate'),el('appUpdateStatus')),el('engineDiagnosticsPanel'),el('inspector'));
 el('seek').closest('.transport').after(bar);document.body.append(pop);
 function close(){pop.hidden=true;pop.dataset.open='';for(const b of bar.children)b.setAttribute('aria-pressed','false');document.documentElement.classList.remove('popOpen')}
 window.openSimplePop=function(key){
  if(!key){close();return}
  if(typeof stop==='function')try{stop()}catch(e){}
  for(const k in secs)secs[k].hidden=k!==key;
  for(const b of bar.children)b.setAttribute('aria-pressed',String(b.dataset.pop===key));
  pop.querySelector('#popTitle').textContent=titles[key];pop.dataset.open=key;pop.hidden=false;
  body.scrollTop=0;document.documentElement.classList.add('popOpen');
  
 };
 pop.querySelector('#popClose').onclick=close;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden&&!document.querySelector('dialog[open]'))close()});
 // Opening a dialog (project, elements) from inside the sheet closes the sheet first.
 for(const id of ['projectMenu','elementEdit','zoneEdit','storyOpen','sampleProject'])el(id).addEventListener('click',close,true)
})();


// ===== Smart status strip and welcome steps =====
(function(){
 const fmt=t=>{t=Math.max(0,Math.round(t));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
 const strip=document.createElement('div');strip.id='smartStrip';strip.setAttribute('role','status');
 el('seek').closest('.transport').after(strip);
 function chip(text,kind,action){
  const c=document.createElement(action?'button':'span');c.className='chip '+(kind||'');c.textContent=text;if(action){c.type='button';c.onclick=action}return c
 }
 window.updateSmartStrip=function(){
  strip.replaceChildren();el('sceneSelect').closest('.scenePicker').hidden=!scenes.length;
  if(!scenes.length){strip.hidden=true;return}
  strip.hidden=false;
  const vid=total(),audio=typeof soundBuffer!=='undefined'?soundBuffer:null;
  strip.append(chip('⏱ '+fmt(vid)+' · '+scenes.length+' مشهد'));
  if(!audio)strip.append(chip('🎙 أضف تعليقًا صوتيًا','hint',()=>el('soundFile').click()));
  else if(Math.abs(audio.duration-vid)>.3)strip.append(chip('الصوت '+fmt(audio.duration)+' والفيديو '+fmt(vid)+' · طابقهما بضغطة','warn',()=>el('fitAudio').click()));
  else strip.append(chip('✓ الصوت مطابق للفيديو','ok'));
  if(!(audio&&Math.abs(audio.duration-vid)>.3))strip.append(chip('✓ جاهز للتصدير','ok'))
 };
 const old=refreshGuide;refreshGuide=function(){old();window.updateSmartStrip()};
 refreshGuide();
 const guide=el('startGuide'),steps=document.createElement('ol');steps.className='welcomeSteps';
 steps.innerHTML='<li><b>1</b><span>اختر صورك</span></li><li><b>2</b><span>أضف صوتك</span></li><li><b>3</b><span>صدّر الفيديو</span></li>';
 guide.querySelector('div').append(steps)
})();

// ===== Slim header: icon, small project title, export. No big title block. =====
(function(){
 const t=document.createElement('span');t.id='hdrTitle';
 const sync=()=>{t.textContent=el('titleView').textContent};sync();
 new MutationObserver(sync).observe(el('titleView'),{childList:true,characterData:true,subtree:true});
 document.querySelector('header .logo').after(t)
})();

// Hide the empty status box when it has no text.
(function(){const m=el('msg'),f=()=>m.classList.toggle('blank',!m.textContent.trim());f();new MutationObserver(f).observe(m,{childList:true,characterData:true,subtree:true})})();
