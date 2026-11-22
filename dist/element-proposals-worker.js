'use strict';
// Optional local inference. Source pixels and prompts never leave this worker's origin.
importScripts('vendor/ort/ort.wasm.min.js','editor-core.js');
ort.env.wasm.wasmPaths=new URL('vendor/ort/',self.location.href).href;ort.env.wasm.numThreads=1;
const FILES=[['mobile_sam_image_encoder.onnx','580f5fb648ea1062c0aabc26217aed56921985f03f0cbbd852bba81d760cc749'],['sam_mask_decoder_single.onnx','93915fc7c993ab9d59ab8c9ccd3bce37f7509c81ab4150a74abd4d2abbd8570d']];
let state=null,busy=false,idleTimer;
const progress=text=>postMessage({progress:text});
async function loadModel(name,hash){
 const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('rasm-local-models',1);req.onupgradeneeded=()=>req.result.createObjectStore('models');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});let blob;
 try{blob=await new Promise((resolve,reject)=>{const req=db.transaction('models').objectStore('models').get(name);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}finally{db.close()}
 if(!blob){const response=await fetch('models/'+name);if(!response.ok)throw Error('حزمة التحليل الاختيارية غير مثبتة. ثبّت ملفي النموذج أولًا، أو استخدم تحديد النص والفرشاة دون النموذج.');blob=await response.blob()}
 const buffer=blob instanceof ArrayBuffer?blob:await blob.arrayBuffer(),actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(v=>v.toString(16).padStart(2,'0')).join('');if(actual!==hash)throw Error('ملف النموذج غير مطابق للإصدار الموثق.');return new Uint8Array(buffer);
}
async function release(){clearTimeout(idleTimer);const old=state;state=null;try{old?.embedding?.dispose()}finally{await old?.decoder?.release()}}
function idle(){clearTimeout(idleTimer);idleTimer=setTimeout(async()=>{try{await release()}finally{postMessage({expired:true});self.close()}},60000)}
async function prepare(data){
 await release();const {width,height}=data,pixels=new Uint8ClampedArray(data.pixels);if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>4_000_000||pixels.length!==width*height*4)throw Error('أبعاد صورة التحليل غير صالحة.');
 let encoder,embedding,decoder;
 try{
  progress('تحميل النموذج المحلي والتحقق منه…');encoder=await ort.InferenceSession.create(await loadModel(...FILES[0]),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  const scale=1024/Math.max(width,height),rw=Math.round(width*scale),rh=Math.round(height*scale),source=new OffscreenCanvas(width,height),resized=new OffscreenCanvas(rw,rh);source.getContext('2d').putImageData(new ImageData(pixels,width,height),0,0);resized.getContext('2d').drawImage(source,0,0,rw,rh);const rgba=resized.getContext('2d').getImageData(0,0,rw,rh).data,rgb=new Float32Array(rw*rh*3);for(let p=0;p<rw*rh;p++){rgb[p*3]=rgba[p*4];rgb[p*3+1]=rgba[p*4+1];rgb[p*3+2]=rgba[p*4+2]}
  progress('تحليل الصورة على هذا الجهاز…');const input=new ort.Tensor('float32',rgb,[rh,rw,3]);try{const outputs=await encoder.run({input_image:input});embedding=outputs[encoder.outputNames[0]];for(const [name,value]of Object.entries(outputs))if(name!==encoder.outputNames[0])value.dispose()}finally{input.dispose()}
  await encoder.release();encoder=null;decoder=await ort.InferenceSession.create(await loadModel(...FILES[1]),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  const fg=data.foreground?new Uint8Array(data.foreground):new Uint8Array(width*height);if(fg.length!==width*height)throw Error('قناع الحبر لا يطابق الصورة.');if(!data.foreground)for(let p=0;p<fg.length;p++){const q=p*4;fg[p]=Math.hypot((pixels[q]-255)*.92,pixels[q+1]-255,(pixels[q+2]-255)*.92)>=26?1:0}
  state={width,height,scale,fg,embedding,decoder};embedding=null;decoder=null;
 }finally{embedding?.dispose();await encoder?.release();await decoder?.release()}
}
async function predict(points){
 if(!state)throw Error('انتهت جلسة التنقيح. اضغط تجهيز النموذج مجددًا.');
 const {width,height,scale,embedding,decoder,fg}=state,prompt=RasmEditorCore.normalizedPrompts(points,width,height,scale),inputs={image_embeddings:embedding,point_coords:new ort.Tensor('float32',prompt.coords,[1,points.length,2]),point_labels:new ort.Tensor('float32',prompt.labels,[1,points.length]),mask_input:new ort.Tensor('float32',new Float32Array(256*256),[1,1,256,256]),has_mask_input:new ort.Tensor('float32',new Float32Array([0]),[1]),orig_im_size:new ort.Tensor('float32',new Float32Array([height,width]),[2])};let outputs;
 try{outputs=await decoder.run(inputs);const logits=outputs[decoder.outputNames[0]].data,score=Number(outputs[decoder.outputNames[1]].data[0]);if(logits.length!==width*height||!Number.isFinite(score))throw Error('نتيجة النموذج غير صالحة.');
  const mask=new Uint8Array(fg.length),ink=new Uint8Array(fg.length);let area=0,inkCount=0,stableInner=0,stableOuter=0,left=width,top=height,right=0,bottom=0;for(let p=0;p<mask.length;p++){const value=logits[p];if(value>1)stableInner++;if(value>-1)stableOuter++;if(value>0){mask[p]=1;area++;const x=p%width,y=Math.floor(p/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);if(fg[p]){ink[p]=1;inkCount++}}}
  return{mask,ink,area,inkCount,score,stability:stableOuter?stableInner/stableOuter:0,bounds:{left,top,right,bottom}};
 }finally{if(outputs)for(const value of Object.values(outputs))value.dispose();for(const value of Object.values(inputs))if(value!==embedding)value.dispose()}
}
async function automatic(strategy){
 const {width,height,fg}=state,baseline=strategy==='baseline',seeds=baseline?Array.from({length:144},(_,i)=>({x:(i%16+.5)*width/16,y:(Math.floor(i/16)+.5)*height/9})):RasmEditorCore.proposalSeeds(fg,width,height,96),candidates=[];
 for(const [index,point]of seeds.entries()){
  const candidate=await predict([{...point,label:1},{x:0,y:0,label:-1}]);
  // Preserve SAM's padding label for single-point predictions, including the baseline comparison.
  if(candidate.score<.85||candidate.area<(baseline?300:20)||candidate.area>width*height*(baseline?.55:.85)||candidate.inkCount<(baseline?100:6)||(!baseline&&candidate.stability<.75))continue;
  let duplicate=false;for(const previous of candidates){const left=Math.max(candidate.bounds.left,previous.bounds.left),right=Math.min(candidate.bounds.right,previous.bounds.right),top=Math.max(candidate.bounds.top,previous.bounds.top),bottom=Math.min(candidate.bounds.bottom,previous.bounds.bottom);if(left>right||top>bottom)continue;
   const maxIntersection=Math.min((right-left+1)*(bottom-top+1),candidate.area,previous.area),maxInk=Math.min(maxIntersection,candidate.inkCount,previous.inkCount);if(maxIntersection/(candidate.area+previous.area-maxIntersection)<=.85&&(baseline||maxInk/(candidate.inkCount+previous.inkCount-maxInk)<=.92))continue;
   let intersection=0,inkIntersection=0;for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const p=y*width+x;if(candidate.mask[p]&&previous.mask[p])intersection++;if(candidate.ink[p]&&previous.ink[p])inkIntersection++}if(intersection/(candidate.area+previous.area-intersection)>.85||(!baseline&&inkIntersection/(candidate.inkCount+previous.inkCount-inkIntersection)>.92)){duplicate=true;break}}

  if(!duplicate&&candidates.length<60)candidates.push(candidate);if(index%8===0)progress('اقتراحات محلية: '+(index+1)+'/'+seeds.length+' · '+candidates.length+' قناع');
 }
 candidates.sort((a,b)=>b.inkCount-a.inkCount);return{prompts:seeds.length,proposals:candidates.map((c,i)=>({name:'اقتراح '+(i+1),runs:RasmEditorCore.maskRuns(c.ink),width,height,modelScore:c.score,stability:c.stability}))};
}
self.onmessage=async event=>{
 if(busy){postMessage({error:'انتظر انتهاء الطلب الجاري.'});return}busy=true;clearTimeout(idleTimer);const started=performance.now(),data=event.data;
 try{
  if(data.action==='predict'){const result=await predict(data.points);postMessage({prediction:{name:'تحديد ذكي للمراجعة',runs:RasmEditorCore.maskRuns(result.ink),width:state.width,height:state.height,modelScore:result.score,stability:result.stability},seconds:(performance.now()-started)/1000});idle()}
  else{await prepare(data);if(data.action==='prepare'){postMessage({ready:true,seconds:(performance.now()-started)/1000});idle()}else{const result=await automatic(data.strategy);postMessage({...result,seconds:(performance.now()-started)/1000});await release()}}
 }catch(error){await release();postMessage({error:'تعذّر التحليل المحلي: '+String(error?.message||error||'فشل دون تفاصيل من المتصفح')+'. المراجعة اليدوية متاحة.'})}finally{busy=false}
};
