'use strict';
const zoneBoard=el('zoneBoard'),zoneContext=zoneBoard.getContext('2d');
let draft=[],origin=null,zoneScene=null;
function paintZones(extra){
 zoneContext.drawImage(zoneScene.src,0,0,zoneBoard.width,zoneBoard.height);
 [...draft,...(extra?[extra]:[])].forEach((r,i)=>{
  const x=r.x*zoneBoard.width,y=r.y*zoneBoard.height,w=r.w*zoneBoard.width,h=r.h*zoneBoard.height;
  zoneContext.fillStyle='#549a582b';zoneContext.fillRect(x,y,w,h);zoneContext.strokeStyle='#275738';zoneContext.lineWidth=2;zoneContext.strokeRect(x,y,w,h);zoneContext.fillStyle='#275738';zoneContext.fillRect(x,y,23,22);zoneContext.fillStyle='white';zoneContext.font='bold 15px sans-serif';zoneContext.textAlign='center';zoneContext.fillText(String(i+1),x+11,y+16)
 });el('zoneUndo').disabled=!draft.length
}
function atPointer(e){const box=zoneBoard.getBoundingClientRect();return {x:within((e.clientX-box.left)/box.width,0,1,0),y:within((e.clientY-box.top)/box.height,0,1,0)}}
function rectangle(p){return {x:Math.min(origin.x,p.x),y:Math.min(origin.y,p.y),w:Math.abs(origin.x-p.x),h:Math.abs(origin.y-p.y)}}
el('zoneEdit').onclick=()=>{if(!scenes[selected])return;stop();zoneScene=scenes[selected];draft=zoneScene.zones.slice();origin=null;zoneBoard.width=zoneScene.src.width;zoneBoard.height=zoneScene.src.height;el('zoneDialog').showModal();paintZones()};
zoneBoard.onpointerdown=e=>{if(!e.isPrimary||draft.length>=80)return;origin=atPointer(e);zoneBoard.setPointerCapture(e.pointerId)};
zoneBoard.onpointermove=e=>{if(origin&&e.isPrimary)paintZones(rectangle(atPointer(e)))};
zoneBoard.onpointerup=e=>{if(!origin||!e.isPrimary)return;const r=rectangle(atPointer(e));if(r.w>.008&&r.h>.008)draft.push(r);origin=null;paintZones()};
zoneBoard.onpointercancel=()=>{origin=null;paintZones()};
el('zoneUndo').onclick=()=>{draft.pop();paintZones()};
el('zoneSave').onclick=async()=>{
 if(!zoneScene)return;
 const button=el('zoneSave');button.disabled=true;
 el('msg').textContent='جارٍ إعادة تخطيط عناصر الرسم حسب المناطق…';
 zoneScene.zones=draft.slice();
 try{
  await applyZones(zoneScene);
  cache={};el('zoneDialog').close();pick(selected);queueSave();
  el('msg').textContent='تم تطبيق ترتيب مناطق الرسم.';
 }catch(error){
  el('msg').textContent='تعذّر تطبيق ترتيب المناطق: '+String(error?.message||error);
 }finally{button.disabled=false}
};
el('zoneClose').onclick=()=>el('zoneDialog').close();
