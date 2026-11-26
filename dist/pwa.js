'use strict';
(function(){
 const status=document.getElementById('offlineState'),button=document.getElementById('installApp');
 const iosHelp=document.getElementById('iosInstallHelp'),storageButton=document.getElementById('protectStorage'),storageState=document.getElementById('storageState');
 const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const standalone=()=>navigator.standalone===true||window.matchMedia?.('(display-mode: standalone)').matches===true;
 let installPrompt=null,registration=null,lastStatusCheck=0,applyingUpdate=false,autoUpdateArmed=false,interacted=false;
 window.addEventListener('pointerdown',()=>{interacted=true},{capture:true,passive:true});
 window.addEventListener('keydown',()=>{interacted=true},{capture:true});
 async function applyWaitingUpdate(){
  const ready=await navigator.serviceWorker.getRegistration();
  if(!ready?.waiting||applyingUpdate)return false;
  if(!window.RasmPrepareUpdate)return false;
  try{
   const msg=document.getElementById('msg');if(msg)msg.textContent='جارٍ حفظ المشروع وتطبيق التحديث…';
   await window.RasmPrepareUpdate();
   applyingUpdate=true;ready.waiting.postMessage({type:'APPLY_SAVED_UPDATE'});
   return true;
  }catch{return false}
 }
 // Auto-apply a downloaded update without manual steps: right away on a fresh, untouched
 // page or while the app is in the background; otherwise as soon as the app goes to background.
 // The project is always saved first, and a failed save leaves the old version running.
 function maybeAutoApply(){
  if(applyingUpdate||autoUpdateArmed)return;
  autoUpdateArmed=true;
  (async()=>{
   for(let i=0;i<40&&!window.RasmPrepareUpdate;i++)await new Promise(r=>setTimeout(r,500));
   if(applyingUpdate||!window.RasmPrepareUpdate){autoUpdateArmed=false;return}
   const ready=await navigator.serviceWorker.getRegistration();
   if(!ready?.waiting){autoUpdateArmed=false;return}
   if(document.visibilityState==='hidden'||(!interacted&&performance.now()<30000)){autoUpdateArmed=false;await applyWaitingUpdate();return}
   const onHide=async()=>{
    if(document.visibilityState!=='hidden')return;
    document.removeEventListener('visibilitychange',onHide);autoUpdateArmed=false;
    await applyWaitingUpdate();
   };
   document.addEventListener('visibilitychange',onHide);
  })();
 }
 const updateButton=document.getElementById('appUpdate'),updateStatus=document.getElementById('appUpdateStatus');
 const updateSay=text=>{if(updateStatus)updateStatus.textContent=text};
 const say=text=>{if(status)status.textContent=text};
 function updateInstallUI(){
  if(iosHelp)iosHelp.hidden=!isIOS||standalone();
  if(!button)return;
  button.hidden=standalone()||(!installPrompt&&!isIOS);
  button.textContent=installPrompt?'تثبيت رَسم على الجهاز':'طريقة التثبيت على iPhone أو iPad';
 }
 updateInstallUI();
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;updateInstallUI()});
 if(button)button.onclick=async()=>{
  if(!installPrompt){iosHelp?.scrollIntoView({block:'nearest',behavior:'smooth'});iosHelp?.focus();return}
  const pending=installPrompt;installPrompt=null;updateInstallUI();
  try{await pending.prompt();await pending.userChoice}catch{say('يمكنك تثبيت التطبيق من قائمة المتصفح، أو متابعة العمل دون تثبيت.')}
 };
 window.addEventListener('appinstalled',()=>{installPrompt=null;updateInstallUI();if(button)button.hidden=true;say('تم تثبيت التطبيق. نزّل نسخة .rasm احتياطية قبل تنظيف بيانات المتصفح أو نقل المشروع.')});
 function workerMessage(worker,type,timeout=10000){
  if(!worker)return Promise.resolve(null);
  return new Promise(resolve=>{
   const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null)},timeout);
   channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data)};
   try{worker.postMessage({type},[channel.port2])}catch{clearTimeout(timer);channel.port1.close();resolve(null)}
  });
 }
 function waitingUpdate(){
  if(!registration?.waiting)return false;
  say('تحديث جاهز. سيُحفظ مشروعك ويُطبق تلقائيًا عند الخروج من التطبيق، أو اضغط تطبيق التحديث الآن.');if(updateButton)updateButton.textContent='حفظ المشروع وتطبيق التحديث';
  maybeAutoApply();
  return true;
 }
 async function refreshOfflineState(){
  if(!registration?.active||waitingUpdate())return;
  lastStatusCheck=Date.now();
  const state=await workerMessage(registration.active,'OFFLINE_STATUS');
  if(waitingUpdate())return;
  say(state?.ok===true?'المحرر جاهز للعمل دون إنترنت في هذا المتصفح. التحليل الاختياري يحتاج تثبيت النموذج وملفات تشغيله مرة واحدة.':'لم يتأكد اكتمال ملفات العمل دون إنترنت. افتح التطبيق مع الاتصال ثم أعد فتحه قبل الاعتماد عليه دون اتصال.');
 }
 const registered=('serviceWorker' in navigator&&window.isSecureContext)?navigator.serviceWorker.register('service-worker.js',{updateViaCache:'none'}).then(async value=>{
  registration=value;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(applyingUpdate)window.location.reload()});
  registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',()=>{waitingUpdate()}));
  waitingUpdate();await navigator.serviceWorker.ready;await refreshOfflineState();return registration;
 }).catch(()=>{say('لم يكتمل تجهيز العمل دون إنترنت. افتح التطبيق مع الاتصال ثم حاول مجددًا. مشاريعك المحفوظة لم تُحذف.');return null}):Promise.resolve(null);
 if(!('serviceWorker' in navigator)||!window.isSecureContext)say('العمل دون إنترنت يحتاج فتح التطبيق عبر HTTPS أو localhost. استخدام المتصفح لا يتطلب تثبيتًا.');
 if(updateButton)updateButton.onclick=async()=>{
  updateButton.disabled=true;
  try{
   await registered;const ready=await navigator.serviceWorker.getRegistration();if(!ready)throw Error('التحديث غير متاح الآن. افتح التطبيق مع الاتصال بالإنترنت.');
   if(!ready.waiting&&!ready.installing)await ready.update();
   if(ready.installing)await new Promise(resolve=>{const worker=ready.installing;const timer=setTimeout(resolve,15000);worker.addEventListener('statechange',()=>{if(worker.state==='installed'||worker.state==='redundant'){clearTimeout(timer);resolve()}})});
   if(!ready.waiting){updateSay('جارٍ التحقق. إذا ظهر تحديث جاهز اضغط الزر لتطبيقه.');return}
   if(!window.RasmPrepareUpdate)throw Error('انتظر تجهيز المحرر ثم حاول مرة أخرى.');
   updateSay('جارٍ حفظ المشروع قبل التحديث…');await window.RasmPrepareUpdate();
   applyingUpdate=true;ready.waiting.postMessage({type:'APPLY_SAVED_UPDATE'});updateSay('تم الحفظ. جارٍ تشغيل النسخة الجديدة…');
  }catch(error){applyingUpdate=false;updateSay(String(error.message||error))}
  finally{updateButton.disabled=false}
 };
 async function checkForUpdate(){if(registration&&!registration.waiting&&!registration.installing)try{await registration.update();waitingUpdate()}catch{}}
 // Resuming a suspended web app rechecks local cache state without reloading the editor.
 document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-lastStatusCheck>30000){void refreshOfflineState();void checkForUpdate()}});
 window.addEventListener('online',()=>{void refreshOfflineState();void checkForUpdate()});
 if(storageButton){
  storageButton.hidden=typeof navigator.storage?.persist!=='function';
  storageButton.onclick=async()=>{
   storageButton.disabled=true;
   try{
    const kept=await navigator.storage.persist();
    if(storageState)storageState.textContent=kept?'المتصفح منح التخزين الدائم لتقليل الحذف التلقائي. تنظيف بيانات الموقع يدويًا يحذف الحفظ؛ احتفظ بنسخة .rasm.':'لم يمنح المتصفح التخزين الدائم. يظل الحفظ المحلي متاحًا، لكنه قد يُحذف عند نقص المساحة. احتفظ بنسخة .rasm.';
   }catch{if(storageState)storageState.textContent='تعذّر تأكيد الاحتفاظ بالتخزين. احتفظ بنسخة .rasm احتياطية.'}
   finally{storageButton.disabled=false}
  };
 }
 window.RasmOfflineApp=Object.freeze({prepareOptionalRuntime:async()=>{
  const ready=await registered;if(!ready?.active)return false;
  return(await workerMessage(ready.active,'CACHE_OPTIONAL_RUNTIME',30000))?.ok===true;
 }});
})();
