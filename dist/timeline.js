'use strict';
globalThis.RasmTimeline=Object.freeze({
 clampSeconds(value,min=1,max=180){const number=Number(value);return Math.round((Number.isFinite(number)?Math.min(max,Math.max(min,number)):6)*10)/10},
 sceneSeconds(scene){const speed=Number(scene?.speed)||1,duration=Number(scene?.duration);return Math.max(0,Number.isFinite(duration)?duration/speed:6)},
 durationForSeconds(seconds,speed=1){const factor=Math.max(.1,Math.min(1,Number(speed)||1));return this.clampSeconds(seconds)*factor},
 totalSeconds(scenes){return scenes.reduce((sum,scene)=>sum+this.sceneSeconds(scene),0)},
 layout(scenes,pixelsPerSecond=40){let start=0;return scenes.map((scene,index)=>{const duration=this.sceneSeconds(scene),item={index,start,duration,width:duration*pixelsPerSecond};start+=duration;return item})},
 formatTime(value){const seconds=Math.max(0,Number(value)||0),whole=Math.floor(seconds),tenths=Math.floor((seconds-whole)*10),minutes=Math.floor(whole/60),remaining=whole%60;return minutes?String(minutes).padStart(2,'0')+':'+String(remaining).padStart(2,'0')+'.'+tenths:String(remaining)+'.'+tenths}
});