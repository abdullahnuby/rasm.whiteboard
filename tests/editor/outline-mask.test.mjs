import test from 'node:test';
import assert from 'node:assert/strict';
import {createOutlineMask} from '../../.build/editor.js';

function image(width,height,points,color=[20,70,40,255]) {
 const pixels=new Uint8ClampedArray(width*height*4).fill(255);
 for(const [x,y] of points)pixels.set(color,(y*width+x)*4);
 return pixels;
}
for(const [name,points] of [
 ['isolated dot',[[12,12]]],
 ['one-pixel horizontal stroke',Array.from({length:17},(_,i)=>[i+4,12])],
 ['one-pixel vertical stroke',Array.from({length:17},(_,i)=>[12,i+4])],
 ['one-pixel diagonal stroke',Array.from({length:17},(_,i)=>[i+4,i+4])],
])test(`sketch mask retains every source pixel: ${name}`,()=>{
 const pixels=image(25,25,points),before=pixels.slice(),mask=createOutlineMask(pixels,25,25);
 for(const [x,y]of points)assert.equal(mask[y*25+x],1,`lost source stroke at ${x},${y}`);
 assert.deepEqual(pixels,before);
});
test('large flat color areas retain an unfilled interior in the sketch pass',()=>{
 const points=[];for(let y=7;y<34;y++)for(let x=7;x<34;x++)points.push([x,y]);
 const pixels=image(41,41,points,[60,130,180,255]),mask=createOutlineMask(pixels,41,41);
 assert.equal(mask[20*41+20],0);
 assert.equal(mask[7*41+20],1);
 assert.equal(mask[20*41+7],1);
 assert.equal(mask[0],0);
 assert.deepEqual(mask,createOutlineMask(pixels,41,41));
});
test('outline source rejects impossible dimensions',()=>{
 for(const [width,height]of [[0,0],[-1,-1],[1.5,2],[NaN,1]])assert.throws(()=>createOutlineMask(new Uint8ClampedArray(0),width,height),/Invalid outline source/);
});
