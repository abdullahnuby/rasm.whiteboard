import {mkdir,copyFile,readFile,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
const destination=resolve(root,'dist/vendor');
await mkdir(destination,{recursive:true});
async function copyFirst(candidates,target,minBytes){
 let selected=null;
 for(const candidate of candidates){
  try{const info=await stat(resolve(root,candidate));if(info.isFile()&&info.size>=minBytes){selected=candidate;break}}catch{}
 }
 if(!selected)throw new Error('Required browser library not found: '+candidates.join(' or '));
 const source=resolve(root,selected),targetPath=resolve(destination,target);
 await copyFile(source,targetPath);
 const data=await readFile(targetPath);
 return {file:target,source:selected,bytes:data.byteLength,sha256:createHash('sha256').update(data).digest('hex')};
}
const opencv=await copyFirst([
 'node_modules/@techstark/opencv-js/dist/opencv.js'
],'opencv.js',8_000_000);
const paper=await copyFirst([
 'node_modules/paper/dist/paper-core.min.js',
 'node_modules/paper/dist/paper-core.js',
 'node_modules/paper/dist/paper-full.min.js',
 'node_modules/paper/dist/paper-full.js'
],'paper-core.js',80_000);
let opencvLicense='';
for(const path of ['node_modules/@techstark/opencv-js/LICENSE','node_modules/@techstark/opencv-js/LICENSE.txt']){
 try{opencvLicense=await readFile(resolve(root,path),'utf8');if(opencvLicense)break}catch{}
}
let paperLicense='';
for(const path of ['node_modules/paper/LICENSE.txt','node_modules/paper/LICENSE']){
 try{paperLicense=await readFile(resolve(root,path),'utf8');if(paperLicense)break}catch{}
}
if(!opencvLicense||!paperLicense)throw new Error('A third-party license file is missing');
await writeFile(resolve(destination,'THIRD-PARTY-LICENSES.md'),
 '# Third-party browser engines\n\n## OpenCV.js 5.0.0 — Apache-2.0\n\n'+opencvLicense+'\n\n## Paper.js 0.17.0 — MIT\n\n'+paperLicense);
const manifest={opencv:{version:'5.0.0-release.1',license:'Apache-2.0',...opencv},paper:{version:'0.17.0',license:'MIT',...paper}};
await writeFile(resolve(destination,'dependencies.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('RASM browser engines vendored:',JSON.stringify({opencv:opencv.bytes,paper:paper.bytes}));
