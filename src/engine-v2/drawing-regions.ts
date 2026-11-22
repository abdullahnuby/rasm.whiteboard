import { unionBounds } from './geometry.js';
import type { ComponentRecord, RasterAnalysis, RasterElement } from './types.js';
type Zone={readonly x:number;readonly y:number;readonly w:number;readonly h:number};
/** Split raster ownership at author-drawn region boundaries, even through one connected illustration.
 * Earlier regions win overlaps. Pixels outside regions keep their original automatic group.
 * Original analysis stays untouched, so clearing regions restores the original plan exactly.
 */
export function partitionDrawingRegions(analysis:RasterAnalysis,zones:readonly Zone[]):RasterAnalysis {
  if(!zones.length)return analysis;
  if(zones.length>80||zones.some(zone=>![zone.x,zone.y,zone.w,zone.h].every(v=>Number.isFinite(v)&&v>=0&&v<=1)))throw new Error('Invalid manual drawing regions.');
  const {width,height,rasterLabels:original}=analysis,size=width*height;
  const region=new Int16Array(size);region.fill(-1);
  for(let i=zones.length-1;i>=0;i--){
    const zone=zones[i],x0=Math.max(0,Math.ceil(zone.x*width)),y0=Math.max(0,Math.ceil(zone.y*height));
    const x1=Math.min(width,Math.ceil((zone.x+zone.w)*width)),y1=Math.min(height,Math.ceil((zone.y+zone.h)*height));
    for(let y=y0;y<y1;y++)region.fill(i,y*width+x0,y*width+x1);
  }
  const oldOwner=new Map<number,number>();for(const element of analysis.elements)for(const id of element.componentIds)oldOwner.set(id,element.id);
  const labels=new Uint32Array(size),queue=new Uint32Array(size),components:ComponentRecord[]=[],groups=new Map<string,RasterElement>();
  let nextComponent=0;
  for(let seed=0;seed<size;seed++){
    if(!original[seed]||labels[seed])continue;
    const oldId=original[seed],zone=region[seed],id=++nextComponent;let head=0,tail=1;
    queue[0]=seed;labels[seed]=id;
    let minX=seed%width,maxX=minX,minY=(seed/width)|0,maxY=minY;
    while(head<tail){
      const pixel=queue[head++],x=pixel%width,y=(pixel/width)|0;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;
        if(nx<0||ny<0||nx>=width||ny>=height)continue;const neighbor=ny*width+nx;
        if(!labels[neighbor]&&original[neighbor]===oldId&&region[neighbor]===zone){labels[neighbor]=id;queue[tail++]=neighbor}
      }
    }
    const bounds={x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1,cx:(minX+maxX)/2,cy:(minY+maxY)/2};
    const component={id,area:tail,bounds};components.push(component);
    const key=zone>=0?'region:'+zone:'automatic:'+(oldOwner.get(oldId)??oldId),group=groups.get(key);
    if(group){group.componentIds.push(id);group.area+=tail;group.bounds=unionBounds(group.bounds,bounds)}
    else groups.set(key,{id:0,componentIds:[id],area:tail,bounds,orderIndex:0,manualZone:zone});
  }
  const elements=[...groups.values()].map((group,index)=>({...group,id:index+1,orderIndex:index}));
  return {...analysis,rasterLabels:labels,components,elements,diagnostics:{...analysis.diagnostics,componentCount:components.length,elementCount:elements.length,warnings:[...analysis.diagnostics.warnings,'Author regions split raster ownership; earlier regions take precedence in overlaps.']}};
}
