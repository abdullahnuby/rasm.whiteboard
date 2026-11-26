import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createServer} from 'node:http';import {resolve,extname} from 'node:path';import {chromium} from 'playwright';
let version='a';const dist=resolve('dist');const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;let file=resolve(dist,path==='/'?'index.html':path.slice(1));if(!file.startsWith(dist+'/'))throw Error();let body=await readFile(file);if(path==='/service-worker.js')body=Buffer.from(body.toString().replace(/("version":")[^"]+/,`$1browser-upgrade-${version}`));res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body)}catch{res.writeHead(404);res.end()}}).listen(3113,'127.0.0.1');let browser;
const activeVersion=page=>page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();const ch=new MessageChannel();return await new Promise(r=>{ch.port1.onmessage=e=>r(e.data.version);reg.active.postMessage({type:'OFFLINE_STATUS'},[ch.port2])})});
try{
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox'],headless:true});const page=await browser.newPage({viewport:{width:430,height:932}});await page.goto('http://localhost:3113');await page.waitForFunction(()=>!restoring);await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.evaluate(()=>{setTitle('PWA saved upgrade test');queueSave()});await page.waitForTimeout(300);
 // New contract: on a fresh, untouched page a waiting update saves the project, activates and reloads by itself.
 version='b';await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update()});await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
 await page.waitForFunction(()=>document.readyState==='complete'&&!!navigator.serviceWorker.controller);await page.waitForFunction(()=>!restoring);
 assert.equal(await activeVersion(page),'browser-upgrade-b','Fresh page auto-applies a waiting update without clicks');
 assert.equal(await page.evaluate(()=>title),'PWA saved upgrade test','Auto update keeps the saved project');
 // A failed save must not activate the next waiting worker or reload, auto or manual.
 version='c';await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update()});await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);await page.evaluate(()=>{window.RasmPrepareUpdate=async()=>{throw Error('save failed test')}});await page.waitForTimeout(1500);
 assert.equal(await activeVersion(page),'browser-upgrade-b','Failed save keeps the old version running');
 assert.equal(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),true,'Update stays waiting after a failed save');
 // The manual button still applies a waiting update on demand (restore the real save first).
 await page.reload();await page.waitForFunction(()=>!restoring);await page.locator('#appUpdate').scrollIntoViewIfNeeded();await page.locator('#appUpdate').click();await page.waitForTimeout(2000);await page.waitForFunction(()=>document.readyState==='complete');await page.waitForFunction(()=>!restoring);
 assert.equal(await activeVersion(page),'browser-upgrade-c','Manual button applies a waiting update');
 assert.equal(await page.evaluate(()=>title),'PWA saved upgrade test');
 console.log('PWA real worker: fresh page auto-saves, activates and reloads onto a waiting update; failed save blocks it; manual button still applies it; project preserved.');
}finally{await browser?.close();server.close()}
