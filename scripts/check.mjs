import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const html = await readFile('dist/index.html', 'utf8');
const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
for (const file of ['app.js', 'project.js', 'zones.js', 'engine.js', 'engine-worker.js', 'reliability.js', 'timeline.js', 'export.js', 'motion-worker.js']) {
  const js = await readFile('dist/' + file, 'utf8');
  if (file === 'engine-worker.js') {
    assert.ok(js.includes("importScripts('engine.js')"), 'Worker must load its dependencies');
  }
  for (const [, id] of js.matchAll(/el\('([^']+)'\)/g)) {
    assert.ok(ids.includes(id), 'Missing control ' + id);
  }
}
assert.ok(html.indexOf('motion.js') < html.indexOf('engine.js'), 'motion.js must load before engine.js');
assert.ok(html.indexOf('engine.js') < html.indexOf('app.js'), 'engine.js must load before app.js');

assert.ok(html.indexOf('reliability.js') < html.indexOf('timeline.js'), 'reliability.js must load before timeline.js');
assert.ok(html.indexOf('timeline.js') < html.indexOf('export.js'), 'timeline.js must load before export.js');
assert.ok(html.indexOf('export.js') < html.indexOf('app.js'), 'export.js must load before app.js');
