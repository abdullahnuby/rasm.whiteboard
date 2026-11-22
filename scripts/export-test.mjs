import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({});
vm.runInContext(await readFile('dist/export.js','utf8'),context);
const api=context.RasmExport;
const supported=new Set(['video/webm;codecs=vp8,opus','video/webm']);
const fakeRecorder={isTypeSupported(type){return supported.has(type)}};
assert.equal(api.pickMimeType(fakeRecorder),'video/webm;codecs=vp8,opus');
assert.equal(api.pickMimeType({isTypeSupported(){return false}}),'');
assert.equal(api.pickMimeType(null),'');
assert.equal(api.frameDue(100,0,1000/30),true);
assert.equal(api.frameDue(120,100,1000/30),false);
assert.equal(api.frameDue(134,100,1000/30),true);
assert.equal(api.frameDue(101,100,1000/30,true),true);
assert.equal(api.fileExtension('video/mp4;codecs="avc1.42E01E,mp4a.40.2"'),'mp4');
assert.equal(api.fileExtension('video/webm;codecs=vp9,opus'),'webm');
console.log('RASM export tests passed.');

const genericMp4={isTypeSupported:type=>type==='video/mp4'};
assert.equal(api.pickMimeType(genericMp4),'video/mp4','A profile-specific rejection must not hide generic recorder MP4 support.');
assert.ok(api.codecUnavailable(new DOMException('unsupported','NotSupportedError')));
assert.ok(api.codecUnavailable(Error('This specific encoder configuration is not supported in this environment.')));
assert.equal(api.codecUnavailable(Error('Out of memory')),false);
for(const test of [
 {session:{cancelled:false,frameCount:0},supported:true,shouldFallback:true},
 {session:{cancelled:true,frameCount:0},supported:true,shouldFallback:false},
 {session:{cancelled:false,frameCount:1},supported:true,shouldFallback:false},
 {session:{cancelled:false,frameCount:0},supported:false,shouldFallback:false}
]){
 let liveCalls=0,notices=0;const error=new DOMException('Codec unavailable','NotSupportedError');
 const operation=api.encodeWithFallback({preferLive:false,session:test.session,canLive:()=>test.supported,offline:async()=>{throw error},live:async()=>{liveCalls++;return 'live'},onFallback:()=>notices++});
 if(test.shouldFallback)assert.equal(await operation,'live');else await assert.rejects(operation,value=>value===error);
 assert.equal(liveCalls,test.shouldFallback?1:0);assert.equal(notices,liveCalls);
}
let triedOffline=false;assert.equal(await api.encodeWithFallback({preferLive:true,session:{},canLive:()=>true,offline:async()=>{triedOffline=true},live:async()=>42,onFallback:()=>{}}),42);assert.equal(triedOffline,false);
await assert.rejects(api.encodeWithFallback({preferLive:false,session:{cancelled:false,frameCount:0},canLive:()=>true,offline:async()=>{throw Error('Out of memory')},live:async()=>{throw Error('Must not fall back')},onFallback:()=>{}}),/Out of memory/);
let resumes=0,insideClick=false;
class FakeAudioContext{constructor(){this.state='suspended'}resume(){assert.equal(insideClick,true,'Audio resume must run synchronously in the click.');resumes++;this.state='running';return Promise.resolve()}close(){return Promise.resolve()}}
const liveContext=vm.createContext({RasmExport:api,AudioContext:FakeAudioContext,Promise,Object,Error,DOMException,setTimeout,clearTimeout,MediaRecorder:class{static isTypeSupported(type){return type==='video/mp4'}}});
vm.runInContext(await readFile('dist/live-export.js','utf8'),liveContext);
insideClick=true;const prepared=liveContext.RasmLive.prepareAudio();insideClick=false;assert.equal(resumes,1);await prepared.ready;
assert.equal(liveContext.RasmLive.canEncode({canvas:{captureStream(){}},format:'mp4',audio:{}}),true);
assert.equal(liveContext.RasmLive.canEncode({canvas:{captureStream(){}},format:'webm',audio:{}}),false);
console.log('RASM codec fallback, generic MP4 and synchronous audio gesture contracts passed.');
