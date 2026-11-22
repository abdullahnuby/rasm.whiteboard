import {readdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dist=new URL('../dist/',import.meta.url),template=await readFile(new URL('../src/pwa/service-worker.js',import.meta.url),'utf8');
const optional=['vendor/ort/ort.wasm.min.js','vendor/ort/ort-wasm-simd-threaded.mjs','vendor/ort/ort-wasm-simd-threaded.wasm'];
const excluded=new Set(['service-worker.js','offline-cache.json']);
async function walk(relative=''){
 const names=[];for(const entry of await readdir(new URL(relative,dist),{withFileTypes:true})){
  const path=relative+entry.name;if(entry.isDirectory()){if(path!=='models'&&path!=='vendor/ort')names.push(...await walk(path+'/'))}
  else if(!excluded.has(path)&&!path.endsWith('.map')&&!path.startsWith('.'))names.push(path);
 }return names;
}
const core=(await walk()).sort(),hash=createHash('sha256').update(template);let coreBytes=0,optionalBytes=0;
for(const path of [...core,...optional]){const bytes=await readFile(new URL(path,dist));hash.update(path).update(bytes);if(core.includes(path))coreBytes+=bytes.length;else optionalBytes+=bytes.length}
const manifest={version:hash.digest('hex').slice(0,20),core,optional,coreBytes,optionalBytes};
await writeFile(new URL('service-worker.js',dist),'const RASM_OFFLINE='+JSON.stringify(manifest)+';\n'+template);
await writeFile(new URL('offline-cache.json',dist),JSON.stringify(manifest,null,2)+'\n');
console.log('Offline app shell:',core.length,'assets,',coreBytes,'bytes. Optional inference runtime:',optionalBytes,'bytes. No model weights cached.');
