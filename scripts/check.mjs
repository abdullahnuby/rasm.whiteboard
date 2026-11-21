import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const html = await readFile('dist/index.html', 'utf8');
const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
for (const file of ['app.js', 'project.js', 'zones.js', 'engine-v2.js', 'engine.js', 'engine-worker.js', 'reliability.js', 'timeline.js', 'export.js', 'motion-worker.js','offline-export.js','live-export.js','interface.js']) {
  const js = await readFile('dist/' + file, 'utf8');
  if (file === 'engine-worker.js') {
    assert.ok(js.includes("'engine-v2.js'"), 'Image worker must load the shared Engine v2 core');
  }
  for (const [, id] of js.matchAll(/\bel\('([^']+)'\)/g)) {
    assert.ok(ids.includes(id), 'Missing control ' + id);
  }
}
assert.ok(html.includes('id="speedHint"'), 'Speed duration guidance must be present');
assert.ok(html.includes('value="0.1"'), 'Very slow hand-speed preset must be available');
assert.ok(html.includes('id="elementDirection"'), 'Element reading direction must be selectable');
assert.ok(html.includes('id="engineDiagnosticsPanel"'), 'Scene diagnostics panel must be available');
assert.ok(html.includes('id="downloadEngineDiagnostics"'), 'Engine diagnostics export must be available');
const appSource=await readFile('dist/app.js','utf8');
assert.ok(!appSource.includes('frac/.86')&&!appSource.includes('frac/.96'), 'Preview must not use independent hand and image clocks');
assert.ok(!appSource.includes('ctx.rect(0,0,s.src.width,s.src.height*reveal)'), 'Preview must not use a top-to-bottom image wipe');
const projectSource=await readFile('dist/project.js','utf8');
assert.ok(projectSource.includes('await prepareColorSchedule(originals[index])'), 'Playback must wait for element schedules');
assert.ok(projectSource.includes('elementDirection'), 'Reading direction must be persisted in .rasm projects');
assert.ok(html.indexOf('paper-core.js')<html.indexOf('engine-v2.js'), 'Paper.js must load before the engine core');
assert.ok(html.indexOf('engine-v2.js')<html.indexOf('motion.js'), 'Engine v2 must load before the motion adapter');

assert.ok(html.indexOf('motion.js') < html.indexOf('engine.js'), 'motion.js must load before engine.js');
assert.ok(html.indexOf('engine.js') < html.indexOf('app.js'), 'engine.js must load before app.js');

assert.ok(html.indexOf('reliability.js') < html.indexOf('timeline.js'), 'reliability.js must load before timeline.js');
assert.ok(html.indexOf('timeline.js') < html.indexOf('export.js'), 'timeline.js must load before export.js');
assert.ok(html.indexOf('export.js') < html.indexOf('app.js'), 'export.js must load before app.js');


const motionSource=await readFile('dist/motion.js','utf8');
const imageEngineSource=await readFile('dist/engine.js','utf8');
const imageWorkerSource=await readFile('dist/engine-worker.js','utf8');
assert.ok(motionSource.includes('async function applyZones(scene)'), 'Drawing plans must be requested asynchronously');
assert.ok(!motionSource.includes('RasmWhiteboardCore.applyToLegacyScene(scene)'), 'The UI thread must not build drawing plans');
assert.ok(!motionSource.includes('buildSynchronousSchedule'), 'Reveal worker failures must not fall back to blocking main-thread work');
assert.ok(motionSource.includes('انتهت مهلة جدولة البكسلات'), 'Reveal timeout must be visible and actionable');
assert.ok(imageEngineSource.includes('async function planAsync(scene)'), 'Image engine must expose Worker-backed planning');
assert.ok(imageEngineSource.includes('timed out after'), 'Image worker requests must have a watchdog');
assert.ok(imageWorkerSource.includes("action === 'plan'"), 'Image worker must accept off-thread plan requests');
assert.ok(appSource.includes('await applyZones(scene)'), 'Import must await Worker-based planning');
assert.ok(appSource.includes('تفاصيل أول الأخطاء'), 'Import failures must display actionable causes');
