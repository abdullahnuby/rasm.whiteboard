import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {startServer} from './serve.mjs';
const server=startServer(0);
await once(server,'listening');
try{
 const url='http://127.0.0.1:'+server.address().port;
 const html=await readFile('dist/index.html','utf8');
 const files=['/',...Array.from(html.matchAll(/(?:src|href)="([^"#]+)"/g),m=>'/'+m[1]),'/motion-worker.js','/engine-worker.js','/engine-v2.js','/vendor/paper-core.js','/vendor/mediabunny.min.mjs','/assets/marker-hand.webp','/assets/NotoSansArabic-Regular.ttf'];
 for(const path of files){
  const response=await fetch(url+path);assert.equal(response.status,200,'Missing served resource '+path);
  if(path.endsWith('.js')||path.endsWith('.mjs'))assert.ok(response.headers.get('content-type').includes('javascript'),path);
  await response.arrayBuffer()
 }
 assert.equal((await fetch(url+'/vendor/ort/ort-wasm-simd-threaded.wasm',{method:'HEAD'})).headers.get('content-type'),'application/wasm');
 assert.equal((await fetch(url+'/missing.js')).status,404);
}finally{server.close()}
console.log('RASM development server resources passed.');
