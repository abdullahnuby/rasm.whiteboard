import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf','.json':'application/json'};
export function startServer(port=Number(process.argv[process.argv.indexOf('--port')+1])||Number(process.env.PORT)||3000){
 return createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   const path=decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.slice(1));
   const file=resolve(root,path);
   if(!file.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);return res.end()}
   if(!(await stat(file)).isFile()){res.writeHead(404);return res.end()}
   const data=await readFile(file);
   res.writeHead(200,{'Content-Type':(types[extname(file)]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store'});
   res.end(req.method==='HEAD'?undefined:data);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:400);res.end()}
 }).listen(port,'0.0.0.0',()=>console.log('Rasm studio is ready'));
}
if(process.argv[1]===fileURLToPath(import.meta.url))startServer();
