import test from 'node:test';import assert from 'node:assert/strict';import {IDBFactory} from 'fake-indexeddb';
import {ProjectRepository} from '../../.build/editor.js';
const snapshot=()=>({format:'rasm-studio',version:3,title:'test',scenes:[{name:'one',image:new Blob(['image'],{type:'image/png'})}],audio:{name:'voice',blob:new Blob(['audio'],{type:'audio/wav'})},hand:null});
const read=(db,store,key)=>new Promise((resolve,reject)=>{const req=db.transaction(store).objectStore(store).get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
const count=(db,store)=>new Promise(resolve=>{const req=db.transaction(store).objectStore(store).count();req.onsuccess=()=>resolve(req.result)});
test('binary assets deduplicate; stored metadata has no inline binary; hydrate restores file contract',async()=>{
 const repo=await ProjectRepository.open('test',new IDBFactory()),value=snapshot();value.scenes.push({...value.scenes[0],name:'copy'});
 await repo.put('current',value);await repo.put('recovered-1',value);assert.equal(await count(repo.database,'assets'),2);
 const stored=await read(repo.database,'projects','current');assert.equal(stored.storage,'rasm-assets-v1');assert.equal(stored.metadata.scenes[0].image.assetId,stored.metadata.scenes[1].image.assetId);assert.equal(stored.metadata.audio.blob,undefined);
 const restored=await repo.get('current');assert.equal(await restored.scenes[0].image.text(),'image');assert.equal(await restored.audio.blob.text(),'audio');repo.close();
});
test('invalid or superseded saves leave previous project and binaries intact',async()=>{
 const repo=await ProjectRepository.open('test',new IDBFactory());await repo.put('current',snapshot());
 await assert.rejects(repo.put('current',{format:'rasm-studio',scenes:[{image:'invalid'}]}));
 assert.equal(await repo.put('current',{...snapshot(),title:'stale'},()=>false),false);assert.equal((await repo.get('current')).title,'test');assert.equal(await count(repo.database,'assets'),2);repo.close();
});
test('legacy v1 records survive schema upgrade and migrate on save',async()=>{
 const factory=new IDBFactory();const old=await new Promise(resolve=>{const req=factory.open('legacy',1);req.onupgradeneeded=()=>req.result.createObjectStore('projects');req.onsuccess=()=>resolve(req.result)});
 const value=snapshot();await new Promise(resolve=>{const tx=old.transaction('projects','readwrite');tx.objectStore('projects').put(value,'current');tx.oncomplete=resolve});old.close();
 const repo=await ProjectRepository.open('legacy',factory);assert.equal((await repo.get('current')).title,'test');await repo.put('current',await repo.get('current'));assert.equal((await read(repo.database,'projects','current')).storage,'rasm-assets-v1');repo.close();
});
test('recovery deletion only collects assets not referenced by another project',async()=>{
 const repo=await ProjectRepository.open('test',new IDBFactory()),value=snapshot();await repo.put('current',value);await repo.put('recovered-1',value);
 const recoveries=await repo.listRecoveries();assert.equal(recoveries.length,1);assert.equal(recoveries[0].value.title,'test');
 await repo.remove('recovered-1');assert.equal(await count(repo.database,'assets'),2);await repo.remove('current');assert.equal(await count(repo.database,'assets'),0);repo.close();
});
test('custom hand image also uses asset storage and returns a data URL to old project loader',async()=>{
 const repo=await ProjectRepository.open('test',new IDBFactory()),value={...snapshot(),hand:'data:image/png;base64,aGFuZA=='};await repo.put('current',value);assert.equal((await repo.get('current')).hand,value.hand);repo.close();
});
test('blocked upgrade closes a database that opens after the rejected operation',async()=>{
 const opening={},factory={open:()=>opening};let closed=false;
 const pending=ProjectRepository.open('blocked',factory);opening.onblocked();await assert.rejects(pending,/Close other Rasm tabs/);
 opening.result={close:()=>{closed=true}};opening.onsuccess();assert.equal(closed,true);
});
test('failed atomic transaction leaves both metadata and binary assets unchanged',async()=>{
 const repo=await ProjectRepository.open('test',new IDBFactory());await repo.put('current',snapshot());const original=repo.database.transaction.bind(repo.database);
 repo.database.transaction=(...args)=>{const tx=original(...args);queueMicrotask(()=>tx.abort());return tx};
 const replacement=snapshot();replacement.title='replacement';replacement.scenes[0].image=new Blob(['different']);
 await assert.rejects(repo.put('current',replacement));repo.database.transaction=original;
 assert.equal((await repo.get('current')).title,'test');assert.equal(await count(repo.database,'assets'),2);repo.close();
});
test('malformed legacy records can be preserved exactly without trying to decode them',async()=>{
 const repo=await ProjectRepository.open('test',new IDBFactory()),broken={format:'broken',scenes:[{image:'not an image'}],extra:{important:'keep'}};
 await new Promise(resolve=>{const tx=repo.database.transaction('projects','readwrite');tx.objectStore('projects').put(broken,'current');tx.oncomplete=resolve});
 assert.equal(await repo.preserve('current','recovered-malformed'),true);assert.deepEqual(await read(repo.database,'projects','recovered-malformed'),broken);
 await repo.put('current',snapshot());assert.deepEqual(await read(repo.database,'projects','recovered-malformed'),broken);assert.equal(await repo.preserve('missing','recovered-missing'),false);repo.close();
});

test('element ownership binaries are atomic, content-addressed, hydrated, and retained by recoveries',async()=>{const repo=await ProjectRepository.open('elements',new IDBFactory()),value=snapshot();value.scenes[0].elements={metadata:{version:1,width:1,height:1,items:[{id:'element-1'}]},ownership:new Blob([new Uint8Array([1,0])],{type:'application/x-rasm-owners'})};await repo.put('current',value);await repo.put('recovered-element',value);const stored=await read(repo.database,'projects','current');assert.equal(typeof stored.metadata.scenes[0].elements.ownership.assetId,'string');const restored=await repo.get('current');assert.deepEqual([...new Uint8Array(await restored.scenes[0].elements.ownership.arrayBuffer())],[1,0]);await repo.remove('current');assert.equal(await count(repo.database,'assets'),3);await repo.remove('recovered-element');assert.equal(await count(repo.database,'assets'),0);repo.close()});
