import test from 'node:test';import assert from 'node:assert/strict';
import {OperationController,RevisionGate,ProjectStore,EditorSession} from '../../.build/editor.js';
const settings={name:'scene',duration:6,speed:1,motionStyle:'smart',elementDirection:'rtl',mode:'original',tone:4,side:'1',hold:18,paper:'#ffffff',transition:'cut',sourceHand:'auto',handSize:100,weight:1.4,zones:[]};
test('foreground operation cancellation blocks old commits and old cleanup',()=>{
 const controller=new OperationController();const old=controller.begin('importing','old');const next=controller.begin('planning','new');
 assert.ok(old.signal.aborted);assert.equal(old.commit(()=>assert.fail('stale commit')),false);old.finish();assert.equal(controller.state.id,next.id);
 next.progress(.5);assert.equal(controller.state.progress,.5);next.finish();assert.equal(controller.state.phase,'idle');
});
test('revision validation prevents results overwriting an edited project',()=>{
 let revision=1;const controller=new OperationController();const job=controller.begin('planning','test',()=>revision===1);revision++;
 assert.equal(job.commit(()=>assert.fail('edited project overwritten')),false);assert.throws(()=>job.assertCurrent(),{name:'AbortError'});
});
test('per-scene request gate isolates owners and rejects out of order results',()=>{
 const gate=new RevisionGate(),a={},b={};const old=gate.issue(a),other=gate.issue(b),current=gate.issue(a);
 assert.equal(old(),false);assert.equal(current(),true);assert.equal(other(),true);gate.invalidate(a);assert.equal(current(),false);
});
test('project transactions publish immutable metadata atomically',()=>{
 const store=new ProjectStore();store.replace('test',[{...settings,id:'a',assetId:'image-a',revision:0}],'a');const before=store.snapshot;
 assert.throws(()=>store.updateScene('a',{duration:NaN}));assert.equal(store.snapshot,before);
 assert.throws(()=>store.replace('bad',[before.scenes[0],before.scenes[0]],'a'));assert.equal(store.snapshot,before);
 assert.throws(()=>{before.scenes[0].zones.push({x:0,y:0,w:1,h:1})});store.updateScene('a',{name:'changed'});assert.equal(before.scenes[0].name,'scene');assert.equal(store.snapshot.scenes[0].name,'changed');
});
test('legacy adapter stores real settings in typed state and retains undo identity',()=>{
 const session=new EditorSession(),source={},scene={...settings,src:source};session.synchronize([scene],0);const id=session.sceneId(scene);
 scene.name='edited';assert.equal(session.project.snapshot.scenes[0].name,'edited');assert.throws(()=>{scene.duration=NaN});assert.equal(scene.duration,6);
 const clone={...scene};session.synchronize([scene,clone],1);assert.notEqual(session.sceneId(clone),id);assert.equal(session.project.snapshot.scenes[0].assetId,session.project.snapshot.scenes[1].assetId);
 session.synchronize([clone],0);session.synchronize([scene,clone],0);assert.equal(session.sceneId(scene),id);assert.equal(scene.name,'edited');
});
