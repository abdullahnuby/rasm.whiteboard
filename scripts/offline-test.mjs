import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const manifest=JSON.parse(await readFile('dist/offline-cache.json','utf8'));
for(const name of ['index.html','engine-worker.js','motion-worker.js','vendor/mediabunny.min.mjs','pwa.js','app.webmanifest'])assert.ok(manifest.core.includes(name));
assert.ok(!manifest.core.some(path=>path.startsWith('models/')||path.startsWith('stories/')||path.startsWith('vendor/ort/')||path.endsWith('.map')));
assert.equal(manifest.optional.length,3);assert.ok(manifest.stories.includes('stories/composer.mjs'));
let bytes=0;for(const path of manifest.core)bytes+=(await readFile('dist/'+path)).length;assert.equal(bytes,manifest.coreBytes);
const handlers={},stores=new Map([['unrelated-user-cache',new Map()],['rasm-static-'+encodeURIComponent('https://rasm.test/app/')+'-old',new Map()],['rasm-static-other-scope-keep',new Map()]]),added=[];let claimed=false,skipped=false;
function key(request){return typeof request==='string'?request:request.url}
const caches={keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name),open:async name=>{
 if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
 return {match:async request=>store.get(key(request))?.clone(),put:async(request,response)=>store.set(key(request),response),add:async request=>{added.push(key(request));store.set(key(request),new Response('asset'))},addAll:async requests=>{for(const request of requests){added.push(key(request));store.set(key(request),new Response('asset'))}}};
}};
const context=vm.createContext({URL,Request,Response,caches,fetch:async()=>{throw Error('Network deliberately unavailable')},self:{registration:{scope:'https://rasm.test/app/'},location:{origin:'https://rasm.test'},clients:{claim:async()=>{claimed=true}},skipWaiting:()=>{skipped=true},addEventListener:(name,handler)=>handlers[name]=handler}});
vm.runInContext(await readFile('dist/service-worker.js','utf8'),context);
let pending;handlers.install({waitUntil:value=>pending=value});await pending;assert.equal(skipped,false);
assert.ok(!added.some(url=>url.includes('/stories/')),'Story packs must not be downloaded during installation.');
handlers.activate({waitUntil:value=>pending=value});await pending;assert.ok(claimed);assert.ok(stores.has('unrelated-user-cache'));assert.ok(!stores.has('rasm-static-'+encodeURIComponent('https://rasm.test/app/')+'-old'));assert.ok(stores.has('rasm-static-other-scope-keep'));
function request(url,method='GET'){return{url,method,mode:'cors',headers:new Headers()}}
let response;handlers.fetch({request:request('https://rasm.test/app/engine-worker.js'),respondWith:value=>response=value});assert.equal(await(await response).text(),'asset');
for(const value of [request('https://rasm.test/app/models/private.onnx'),request('https://rasm.test/app/user-photo.png'),request('https://outside.test/engine-worker.js'),request('https://rasm.test/app/engine-worker.js?token=private'),request('https://rasm.test/app/engine-worker.js','POST')]){
 let intercepted=false;handlers.fetch({request:value,respondWith:()=>intercepted=true});assert.equal(intercepted,false,'Only fixed same-origin static GET assets may be intercepted.');
}
let result;handlers.message({data:{type:'CACHE_OPTIONAL_RUNTIME',url:'https://outside.test/unrelated'},ports:[{postMessage:value=>result=value}],waitUntil:value=>pending=value});await pending;assert.equal(result.ok,true);assert.ok(added.every(url=>url.startsWith('https://rasm.test/app/')));assert.ok(!added.some(url=>url.includes('models/')));
console.log('RASM offline cache contracts passed:',manifest.coreBytes,'core bytes;',manifest.optionalBytes,'optional runtime bytes.');

const legacyEncoder=Object.freeze({encode:()=>{}}),ui={offlineState:{},installApp:{hidden:true}},window={isSecureContext:false,addEventListener:()=>{},RasmOffline:legacyEncoder};
const uiContext=vm.createContext({window,navigator:{},document:{getElementById:id=>ui[id]},Promise,Object});
vm.runInContext(await readFile('dist/pwa.js','utf8'),uiContext);
assert.equal(window.RasmOffline,legacyEncoder,'Install support must not replace the existing offline encoder.');
assert.equal(await window.RasmOfflineApp.prepareOptionalRuntime(),false);
console.log('RASM install/encoder namespace isolation passed.');

// iOS uses manual Home Screen guidance; installed apps must not offer another install.
const pwaSource=await readFile('dist/pwa.js','utf8');
function installUI({ios=false,ipad=false,standalone=false,displayStandalone=false,persist}={}){
 const events={},nodes=Object.fromEntries(['offlineState','installApp','iosInstallHelp','protectStorage','storageState'].map(id=>[id,{hidden:true,focus(){this.focused=true},scrollIntoView(){this.scrolled=true}}]));
 const win={isSecureContext:false,addEventListener:(type,handler)=>events[type]=handler,matchMedia:()=>({matches:displayStandalone})};
 const nav={userAgent:ios?'iPhone':'desktop',platform:ipad?'MacIntel':'',maxTouchPoints:ipad?5:0,standalone,storage:persist?{persist}:undefined};
 vm.runInNewContext(pwaSource,{window:win,navigator:nav,document:{getElementById:id=>nodes[id],addEventListener:()=>{}},Promise,Object,Date});
 return{nodes,events,win};
}
for(const args of[{ios:true},{ipad:true}]){
 const {nodes}=installUI(args);assert.equal(nodes.iosInstallHelp.hidden,false);assert.equal(nodes.installApp.hidden,false);await nodes.installApp.onclick();assert.equal(nodes.iosInstallHelp.focused,true);
}
for(const args of[{ios:true,standalone:true},{ios:true,displayStandalone:true}]){
 const {nodes}=installUI(args);assert.equal(nodes.iosInstallHelp.hidden,true);assert.equal(nodes.installApp.hidden,true);
}
const desktopUI=installUI();assert.equal(desktopUI.nodes.iosInstallHelp.hidden,true);assert.equal(desktopUI.nodes.installApp.hidden,true);
let prompted=false,prevented=false;desktopUI.events.beforeinstallprompt({preventDefault(){prevented=true},async prompt(){prompted=true},userChoice:Promise.resolve({outcome:'accepted'})});await desktopUI.nodes.installApp.onclick();assert.ok(prevented&&prompted);
for(const result of[true,false,'error']){
 const {nodes}=installUI({persist:async()=>{if(result==='error')throw Error('Unavailable');return result}});
 assert.equal(nodes.protectStorage.hidden,false);await nodes.protectStorage.onclick();assert.equal(nodes.protectStorage.disabled,false);assert.ok(nodes.storageState.textContent.includes('.rasm'));
}
const html=await readFile('dist/index.html','utf8');assert.ok(html.includes('viewport-fit=cover'));assert.ok(html.includes('apple-mobile-web-app-capable'));assert.ok(html.includes('apple-touch-icon'));assert.ok(manifest.core.includes('assets/apple-touch-icon.png'));
handlers.message({data:{type:'OFFLINE_STATUS'},ports:[{postMessage:value=>result=value}],waitUntil:value=>pending=value});await pending;assert.equal(result.ok,true);
const installedCore=[...stores.entries()].find(([name])=>name.includes(manifest.version)&&!name.includes('optional'));const removed=installedCore[1].get('https://rasm.test/app/pwa.js');installedCore[1].delete('https://rasm.test/app/pwa.js');
handlers.message({data:{type:'OFFLINE_STATUS'},ports:[{postMessage:value=>result=value}],waitUntil:value=>pending=value});await pending;assert.equal(result.ok,false,'An active worker alone is not proof of a complete offline cache.');installedCore[1].set('https://rasm.test/app/pwa.js',removed);
console.log('RASM iPhone/iPad install guidance, standalone, storage refusal/error and cache-loss detection passed.');

const appleIcon=await readFile('dist/assets/apple-touch-icon.png');assert.equal(appleIcon.readUInt32BE(16),180);assert.equal(appleIcon.readUInt32BE(20),180);assert.equal(appleIcon[25],2,'Apple touch icon must be opaque RGB, without alpha corners.');
