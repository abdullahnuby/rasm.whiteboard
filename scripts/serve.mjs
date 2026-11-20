import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const types={'/assets/marker-hand.webp':'image/webp','/engine.js':'text/javascript','/engine-worker.js':'text/javascript','/motion.js':'text/javascript','/zones.js':'text/javascript','/index.html':'text/html','/app.js':'text/javascript','/style.css':'text/css','/project.js':'text/javascript'};
createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const key=path==='/'?'/index.html':path;
 if(!Object.hasOwn(types,key)){res.writeHead(404);return res.end()}
 try{const data=await readFile(new URL('../dist'+key,import.meta.url));res.writeHead(200,{'Content-Type':types[key]+'; charset=utf-8'});res.end(data)}catch{res.writeHead(500);res.end()}
}).listen(Number(process.env.PORT)||3000,()=>console.log('Rasm studio is ready'));
