import {C,path,transform,grass,leaf,Scene} from '../primitives.mjs';import {tree,garden} from './garden-art.mjs';
const rule=()=>path('M350 149 C495 136 760 167 933 144 C782 174 513 149 350 155 Z',C.gold,'none',0);
export async function stages(){const response=await fetch(new URL('./seedling.json',import.meta.url));if(!response.ok)throw Error('تعذّر تحميل حزمة النبات. اتصل مرة لتحميلها ثم أعد المحاولة.');const data=await response.json();const result=[];
 const addSeedGroups=(s,ids,moveSeed=0)=>{s.defs=[data.defs];s.add('caption-rule','زخرفة العنوان',rule());for(const g of data.groups)if(ids.includes(g.id))s.add(g.id,g.label,g.id==='seed'&&moveSeed?transform(0,moveSeed,1,0,g.body):/rain/.test(g.id)?transform(0,45,1,0,g.body):g.body);return s};
 let s=addSeedGroups(new Scene('plant-seed','بذرة في التربة'),['soil-base','soil-texture','soil-edge','soil-pebbles','seed'],60);result.push(s);
 s=addSeedGroups(new Scene('plant-germination','بداية الإنبات'),['soil-base','soil-texture','soil-edge','soil-pebbles','seed'],25);
 s.add('first-root','الجذر الأول',path('M635 549 C641 577 626 605 632 646 C632 610 651 578 643 548 Z','#f7e8b9',C.ink,2.3)+path('M635 582 Q607 587 600 605 M632 611 Q655 614 665 634','none','#f7e8b9',4)+path('M635 582 Q607 587 600 605 M632 611 Q655 614 665 634','none',C.ink,1));
 s.add('first-shoot','الساق الأولى والأوراق',path('M635 535 C642 510 629 484 637 452 L643 453 C636 484 650 513 643 536 Z',C.leaf,C.ink,2.8)+leaf(639,477,.52,27,C.leaf)+leaf(640,484,.45,113,C.light,1));result.push(s);
 s=addSeedGroups(new Scene('plant-seedling','جذور وأوراق'),data.groups.map(g=>g.id));result.push(s);
 s=new Scene('plant-young-tree','شجرة فتية');s.add('caption-rule','زخرفة العنوان',rule()).add('ground','الأرض',path('M242 663 Q635 642 1044 666','none',C.ink,3));tree(s,640,654,.73);s.add('grass','حشائش الأرض',grass(395,661,.65)+grass(863,661,.61)+path('M488 679 l20 -1 M747 680 l22 1','none',C.green,1.4));result.push(s);
 s=garden({});s.id='plant-grown-tree';s.title='شجرة نامية';s.groups=s.groups.filter(g=>g.id!=='caption-accents');s.groups.unshift({id:'caption-rule',label:'زخرفة العنوان',body:rule()});result.push(s);return result;
}
