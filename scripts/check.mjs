import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const html = await readFile('dist/index.html', 'utf8');
const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
for (const file of ['app.js', 'project.js', 'zones.js', 'shape-engine.js', 'engine.js', 'engine-worker.js', 'reliability.js', 'timeline.js', 'export.js', 'motion-worker.js','offline-export.js','live-export.js','interface.js']) {
  const js = await readFile('dist/' + file, 'utf8');
  if (file === 'engine-worker.js') {
    assert.ok(js.includes("importScripts('shape-engine.js','engine.js')"), 'Worker must load the shape and image engines');
    assert.ok(js.includes("vendor/opencv.js"), 'Worker must load bundled OpenCV.js');
    assert.ok(js.includes("vendor/paper-core.js"), 'Worker must load bundled Paper.js');
  }
  for (const [, id] of js.matchAll(/\bel\('([^']+)'\)/g)) {
    assert.ok(ids.includes(id), 'Missing control ' + id);
  }
}
assert.ok(html.includes('id="speedHint"'), 'Speed duration guidance must be present');
assert.ok(html.includes('value="0.1"'), 'Very slow hand-speed preset must be available');
assert.ok(html.includes('value="0.2"'), 'Slower default hand speed must be available');
const appSource = await readFile('dist/app.js', 'utf8');
assert.ok(!appSource.includes('frac/.86') && !appSource.includes('frac/.96'), 'Hand and image reveal must not use separate delayed clocks');
assert.ok(appSource.includes('strokeProgress(s,frac)'), 'Hand must use the same progress clock as the image reveal');
assert.ok(appSource.includes('revealPixels(cache.pixels,reveal)'), 'Original image reveal must follow hand progress directly');
assert.ok(!appSource.includes('ctx.rect(0,0,s.src.width,s.src.height*reveal)'), 'Original preview must never use a top-to-bottom fallback wipe');
const projectSource = await readFile('dist/project.js', 'utf8');
assert.ok(projectSource.includes('handPaceVersion'), 'New slow drawing pace must persist in project files');
assert.ok(projectSource.includes('await prepareColorSchedule(originals[i])'), 'Playback must wait for element-aware schedules before starting');

assert.ok(html.includes('id="shapeSequence"'), 'Shape-level sequencing control must be available');
assert.ok(html.includes('id="elementDirection"'), 'Element direction selector must be available');
const shapeEngineSource = await readFile('dist/shape-engine.js', 'utf8');
assert.ok(shapeEngineSource.includes('encloses(A,B)||encloses(B,A)'), 'Enclosed illustration content must group with its outer element');
const motionSource = await readFile('dist/motion.js', 'utf8');
assert.ok(motionSource.includes('for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)'), 'Raster reveal connectivity must match 8-connected segmentation');
assert.ok(html.includes('value="rtl">من اليمين إلى الشمال'), 'Arabic default direction must be RTL');
assert.ok(html.includes('value="ltr">من الشمال إلى اليمين'), 'LTR sequence must be selectable');
assert.ok(html.includes('value="smart">عنصر كامل ثم التالي'), 'Element-first sequence must be the default');
assert.ok(html.indexOf('motion.js') < html.indexOf('shape-engine.js'), 'motion.js must load before the shape engine');
assert.ok(html.indexOf('shape-engine.js') < html.indexOf('engine.js'), 'shape engine must load before image engine');
assert.ok(html.indexOf('engine.js') < html.indexOf('app.js'), 'engine.js must load before app.js');

assert.ok(html.indexOf('reliability.js') < html.indexOf('timeline.js'), 'reliability.js must load before timeline.js');
assert.ok(html.indexOf('timeline.js') < html.indexOf('export.js'), 'timeline.js must load before export.js');
assert.ok(html.indexOf('export.js') < html.indexOf('app.js'), 'export.js must load before app.js');
