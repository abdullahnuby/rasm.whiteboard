import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({Uint8Array,Uint16Array,Uint32Array,Int32Array,Map,Set,Math,Number,Array,Object});
vm.runInContext(await readFile('dist/shape-engine.js','utf8'),context);
const engine=context.RasmShapeEngine;
assert.ok(engine,'Shape engine API must be available');
const width=160,height=96,mask=new Uint8Array(width*height);
function rect(x,y,w,h){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)mask[yy*width+xx]=1}
rect(115,18,12,28);rect(102,20,9,26);rect(107,7,5,5); // one Arabic-like glyph with a detached dot
rect(20,58,18,16);rect(47,58,18,16); // separate drawing objects
const paths=[
 {points:[[121,20],[121,44],[115,44]],color:'#111'},
 {points:[[106,21],[106,44],[111,44]],color:'#111'},
 {points:[[108,8],[110,8],[110,11]],color:'#111'},
 {points:[[21,59],[37,59],[37,73]],color:'#111'},
 {points:[[48,59],[64,59],[64,73]],color:'#111'}
];
const result=engine.analyze(mask,width,height,paths,paths,null);
assert.equal(result.rasterLabels.length,width*height);
assert.ok(result.metrics.shapes>=2,'Detached strokes should become shape groups');
assert.equal(result.metrics.shapes,4,'Nearby major objects must remain separate while detached dots attach to their glyph');
assert.ok(result.centerGroups.every(group=>Array.isArray(group.rasterLabels)&&group.rasterLabels.length>0),
 'Every detected element needs the matching raster ownership id');
const usedRasterIds=new Set(result.centerGroups.flatMap(group=>group.rasterLabels));
assert.ok([...usedRasterIds].every(id=>[...result.rasterLabels].includes(id)),
 'Stroke ownership ids must match the IDs stored in the per-pixel label map');
assert.equal(result.metrics.groupedCenterPaths,paths.length,'Every stroke must belong to a group');
const assigned=result.centerGroups.filter(group=>group.lineIndices.length);
assert.ok(assigned.length>=2&&assigned.length<paths.length,'Related strokes must be grouped, separate objects must stay separate');
assert.ok(result.centerGroups.every(group=>Array.isArray(group.lineIndices)));
assert.ok(result.rasterLabels.some(label=>label>0),'Foreground component labels should be generated');
const close = engine.mergeComponents([
 {label:1,area:100,bounds:{x:0,y:0,width:10,height:10,cx:5,cy:5}},
 {label:2,area:8,bounds:{x:3,y:-8,width:4,height:4,cx:5,cy:-6}},
 {label:3,area:20,bounds:{x:60,y:0,width:10,height:10,cx:65,cy:5}}
],100,80);
assert.equal(close.groups.length,2,'Nearby diacritics should merge with their glyph but distant shapes should remain separate');
console.log('RASM shape engine tests passed.');
