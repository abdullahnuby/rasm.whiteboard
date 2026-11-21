import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('dist/vendor/dependencies.json','utf8'));
assert.equal(manifest.opencv.version,'5.0.0-release.1');
assert.equal(manifest.paper.version,'0.17.0');
assert.ok(manifest.opencv.bytes>8_000_000,'OpenCV.js must be bundled locally, not fetched from a CDN');
assert.ok(manifest.paper.bytes>80_000,'Paper.js core must be bundled locally');
for(const file of ['opencv.js','paper-core.js','THIRD-PARTY-LICENSES.md']){
 const info=await stat('dist/vendor/'+file);assert.ok(info.size>100,file+' must be present in the deployment');
}
console.log('RASM local computer-vision and vector libraries passed.');
