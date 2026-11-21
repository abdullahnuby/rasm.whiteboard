'use strict';
const optionalLibraries={opencv:false,paper:false};
try{importScripts('vendor/paper-core.js');optionalLibraries.paper=!!self.paper}catch(error){self.__RASM_PAPER_LOAD_ERROR__=String(error?.message||error)}
try{importScripts('vendor/opencv.js');optionalLibraries.opencv=true}catch(error){self.__RASM_OPENCV_LOAD_ERROR__=String(error?.message||error)}
importScripts('shape-engine.js','engine.js');

function waitForOpenCv(timeout=25000){
 return new Promise(resolve=>{
  let settled=false,attempts=0;
  const finish=value=>{if(settled)return;settled=true;resolve(value?.Mat?value:null)};
  const inspect=()=>{
   const candidate=self.cv||self.Module;
   if(candidate?.Mat){finish(candidate);return}
   if(candidate&&typeof candidate.then==='function'){
    Promise.resolve(candidate).then(finish,()=>finish(null));return
   }
   if(++attempts*80>=timeout){finish(null);return}
   setTimeout(inspect,80)
  };
  inspect()
 })
}
const cvReady=waitForOpenCv();
self.onmessage=async event=>{
 const {id,width,height,pixels}=event.data||{};
 try{
  const cv=await cvReady;
  const data=new Uint8ClampedArray(pixels);
  const result=self.RasmImageEngine.extractPaths(data,width,height,{cv,paper:self.paper});
  if(result.shapeMetrics)result.shapeMetrics.library= cv?'OpenCV.js 5':'built-in connected components';
  const transfers=[];
  if(result.rasterLabels?.buffer)transfers.push(result.rasterLabels.buffer);
  self.postMessage({id,result,engineLibraries:{opencv:!!cv,paper:!!self.paper}},transfers);
 }catch(error){
  self.postMessage({id,error:String(error&&error.message||error),stack:String(error&&error.stack||'')});
 }
};
