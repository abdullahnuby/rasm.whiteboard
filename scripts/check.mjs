import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile('dist/index.html','utf8');
const ids=[...html.matchAll(/ id="([^"]+)"/g)].map(match=>match[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');
for(const file of ['app.js','project.js','zones.js']){
 const js=await readFile('dist/'+file,'utf8');
 for(const [,id] of js.matchAll(/el\('([^']+)'\)/g))assert.ok(ids.includes(id),'Missing control '+id);
}
