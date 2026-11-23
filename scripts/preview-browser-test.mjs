// Optional integration test: npm install --no-save playwright; CHROME_BIN=/path/to/chrome node scripts/preview-browser-test.mjs
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
import {startServer} from './serve.mjs';
const evidence=process.env.EVIDENCE_DIR||'/downloads/rasm-audio-evidence';await mkdir(evidence,{recursive:true});
const server=startServer(3112);let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--autoplay-policy=document-user-activation-required']});
 const page=await browser.newPage({viewport:{width:430,height:932},deviceScaleFactor:1});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  // Observe the real speaker graph in addition to its usual destination, without replacing it.
  const original=AudioContext.prototype.createBufferSource;
  AudioContext.prototype.createBufferSource=function(){const node=original.call(this),connect=node.connect.bind(node);node.connect=function(target,...rest){const result=connect(target,...rest);if(target===this.context.destination){window.previewTap||=(this.context.createMediaStreamDestination());connect(window.previewTap);window.previewMeter||=(this.context.createAnalyser());connect(window.previewMeter)}return result};return node};
 });
 await page.goto('http://localhost:3112');await page.waitForFunction(()=>typeof restoring!=='undefined'&&!restoring);
 const imageFixtures=await page.evaluate(()=>[0,1].map(i=>{const canvas=document.createElement('canvas');canvas.width=480;canvas.height=270;const c=canvas.getContext('2d');c.fillStyle='white';c.fillRect(0,0,480,270);c.fillStyle=i?'#35bfae':'#ffca38';c.fillRect(70,80,150,140);c.strokeStyle='black';c.lineWidth=6;c.strokeRect(70,80,150,140);c.beginPath();c.arc(340,150,70,0,Math.PI*2);c.moveTo(270,80);c.lineTo(410,220);c.stroke();return canvas.toDataURL().split(',')[1]}));
 await page.locator('#files').setInputFiles(imageFixtures.map((data,i)=>({name:'scene-'+i+'.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')})));await page.waitForFunction(()=>!loading&&scenes.length===2,{timeout:60000});
 await page.evaluate(()=>{for(const scene of scenes){scene.duration=1;scene.speed=1}time=0;refresh()});
 const samples=8*44100,wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(8191*Math.sin(2*Math.PI*(440+220*Math.floor(i/88200))*i/44100)),44+i*2);
 await page.locator('#soundFile').setInputFiles({name:'test-narration.wav',mimeType:'audio/wav',buffer:wav});await page.waitForFunction(()=>!loading&&soundBuffer?.duration>7.9);
 await page.locator('#play').click();await page.waitForFunction(()=>running&&time>.15);
 const first=await page.evaluate(()=>{const samples=new Float32Array(previewMeter.fftSize);previewMeter.getFloatTimeDomainData(samples);return {running,time,context:audioContext.state,rms:Math.sqrt(samples.reduce((s,x)=>s+x*x,0)/samples.length),max:+range.max,images:total()}});
 assert.ok(first.rms>.01,'The preview speaker graph must contain non-silent samples');assert.equal(first.max,8);
 await page.evaluate(()=>{window.previewRecording=[];window.previewCapture=board.captureStream(24);for(const track of previewTap.stream.getAudioTracks())previewCapture.addTrack(track);window.previewRecorder=new MediaRecorder(previewCapture,{mimeType:'video/webm;codecs=vp8,opus'});previewRecorder.ondataavailable=e=>previewRecording.push(e.data);previewRecorder.start()});
 await page.waitForFunction(()=>time>2.3);assert.equal(await page.evaluate(()=>running),true,'Narration must keep playing beyond the last image');
 // Click the actual waveform at 4.25 seconds while playing.
 await page.locator('#timelineAudioTrack').scrollIntoViewIfNeeded();await page.evaluate(()=>{el('timelineScroll').scrollLeft=0});
 const box=await page.locator('#timelineContent').boundingBox();const lane=await page.locator('#timelineAudioTrack').boundingBox();
 await page.mouse.click(box.x+4.25*40,lane.y+lane.height/2);await page.waitForFunction(()=>running&&time>=4.25&&time<5);
 const seek=await page.evaluate(()=>({running,time,audio: soundPosition(0)}));assert.ok(Math.abs(seek.time-seek.audio)<.15);
 await page.screenshot({path:evidence+'/editor-playing-mobile.png',fullPage:true});
 const contentBox=await page.locator('#timelineContent').boundingBox(),clipBox=await page.locator('#timelineVideoTrack').boundingBox();
 await page.mouse.click(contentBox.x+1.25*40,clipBox.y+clipBox.height/2);await page.waitForFunction(()=>running&&time>=1.25&&time<2);assert.equal(await page.evaluate(()=>selected),1,'Clicking an image clip must seek precisely, not jump to 75%');
 await page.waitForTimeout(500);
 const encoded=await page.evaluate(async()=>{await new Promise(resolve=>{previewRecorder.onstop=resolve;previewRecorder.stop()});const data=new Uint8Array(await new Blob(previewRecording).arrayBuffer());return Array.from(data)});await writeFile(evidence+'/editor-preview-playback.webm',Buffer.from(encoded));
 await page.locator('#play').click();const paused=await page.evaluate(()=>({running,time}));await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>time),paused.time);assert.equal(paused.running,false);
 await page.locator('#seek').evaluate(el=>{el.value='1.25';el.dispatchEvent(new Event('input',{bubbles:true}))});assert.equal(await page.evaluate(()=>running),false);
 await page.locator('#play').click();await page.waitForFunction(()=>running&&time>1.25&&time<2);
 const resume=await page.evaluate(()=>({time,audio:soundPosition(0)}));assert.ok(Math.abs(resume.time-resume.audio)<.15);
 await page.waitForFunction(()=>!running&&time>=8,{timeout:10000});
 await page.locator('#play').click();await page.waitForFunction(()=>running&&time<1);await page.locator('#play').click();
 // Audio-only projects remain usable for laying out images against narration.
 await page.evaluate(()=>{scenes=[];time=0;refresh()});assert.equal(await page.locator('#play').isEnabled(),true);await page.locator('#play').click();await page.waitForFunction(()=>running&&time>.2);await page.locator('#play').click();
 assert.deepEqual(errors,[]);const report={first,seek,resume,paused,audioOnly:true,pageErrors:errors,scope:'Chromium preview speaker-graph capture, not physical iPhone speaker verification'};await writeFile(evidence+'/results.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser?.close();server.close()}
