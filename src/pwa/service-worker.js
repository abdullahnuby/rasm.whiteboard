'use strict';
// Build-generated RASM_OFFLINE contains only this app's fixed static assets.
const PREFIX='rasm-static-'+encodeURIComponent(self.registration.scope)+'-',CORE=PREFIX+RASM_OFFLINE.version,OPTIONAL=PREFIX+'optional-'+RASM_OFFLINE.version;
const absolute=path=>new URL(path,self.registration.scope).href;
const coreURLs=new Set(RASM_OFFLINE.core.map(absolute)),optionalURLs=new Set(RASM_OFFLINE.optional.map(absolute));
async function ensureOptional(){const cache=await caches.open(OPTIONAL);for(const path of RASM_OFFLINE.optional){const url=absolute(path);if(!await cache.match(url))await cache.add(new Request(url,{cache:'reload'}))}}
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CORE).then(cache=>cache.addAll(RASM_OFFLINE.core.map(path=>new Request(absolute(path),{cache:'reload'})))));
 // No skipWaiting: updates must not replace the code beneath an open project.
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CORE&&key!==OPTIONAL)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.search||request.headers.has('range'))return;
 const navigation=request.mode==='navigate'&&(url.href===self.registration.scope||url.href===absolute('index.html'));
 if(navigation){event.respondWith(caches.open(CORE).then(cache=>cache.match(absolute('index.html'))).then(response=>response||fetch(request)));return}
 const cacheName=coreURLs.has(url.href)?CORE:optionalURLs.has(url.href)?OPTIONAL:null;
 if(!cacheName)return; // Never cache user files, model weights, APIs or arbitrary URLs.
 event.respondWith((async()=>{const cache=await caches.open(cacheName),cached=await cache.match(request);if(cached)return cached;const response=await fetch(request);if(response.ok&&response.type==='basic')await cache.put(request,response.clone());return response})());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='OFFLINE_STATUS'){
  event.waitUntil((async()=>{
   const cache=await caches.open(CORE);
   const entries=await Promise.all(RASM_OFFLINE.core.map(path=>cache.match(absolute(path))));
   event.ports[0]?.postMessage({ok:entries.every(Boolean),version:RASM_OFFLINE.version});
  })().catch(()=>event.ports[0]?.postMessage({ok:false})));
  return;
 }
 if(event.data?.type!=='CACHE_OPTIONAL_RUNTIME')return;
 event.waitUntil(ensureOptional().then(()=>event.ports[0]?.postMessage({ok:true})).catch(()=>event.ports[0]?.postMessage({ok:false})));
});
