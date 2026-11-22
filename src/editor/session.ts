import { ProjectStore, type SceneMetadata, type SceneSettings } from './project-store.js';
import { OperationController } from './operations.js';
const fields = ['revealMode','name','duration','speed','motionStyle','elementDirection','mode','tone','side','hold','paper','transition','sourceHand','handSize','weight','zones'] as const;
const defaults: SceneSettings = {revealMode:'direct',name:'مشهد',duration:10,speed:.2,motionStyle:'smart',elementDirection:'rtl',mode:'original',tone:4,side:'1',hold:18,paper:'#ffffff',transition:'cut',sourceHand:'auto',handSize:100,weight:1.4,zones:[]};
interface Binding { metadata: SceneMetadata; }
/** Temporary boundary for the old DOM controllers. Settings live in the typed store, not both places. */
export class EditorSession {
  readonly project = new ProjectStore();
  readonly operations = new OperationController();
  private bindings = new WeakMap<object, Binding>();
  private imageIds = new WeakMap<object,string>();
  private nextId=0;
  private title='مشروع وايت بورد';
  private bind(scene: Record<string,unknown>):Binding {
    const existing=this.bindings.get(scene);if(existing)return existing;
    const id='scene-'+(++this.nextId);
    const source=scene.src;
    let assetId=id+'-image';
    if(typeof source==='object'&&source!==null){assetId=this.imageIds.get(source)??assetId;this.imageIds.set(source,assetId)}
    const values=Object.fromEntries(fields.map(key=>[key,scene[key]??defaults[key]])) as unknown as SceneSettings;
    const binding:Binding={metadata:{...values,zones:values.zones.map(zone=>({...zone})),id,assetId,revision:0}};
    this.bindings.set(scene,binding);
    for(const key of fields){
      Object.defineProperty(scene,key,{enumerable:true,configurable:false,
        get:()=>{
          binding.metadata=this.project.snapshot.scenes.find(row=>row.id===id)??binding.metadata;
          return binding.metadata[key];
        },
        set:(value:unknown)=>{
          const active=this.project.snapshot.scenes.some(row=>row.id===id);
          const update={ [key]:value } as Partial<SceneSettings>;
          if(active){this.project.updateScene(id,update);binding.metadata=this.project.snapshot.scenes.find(row=>row.id===id)!}
          else binding.metadata={...binding.metadata,...update,revision:binding.metadata.revision+1};
        }
      });
    }
    return binding;
  }
  synchronize(scenes:Record<string,unknown>[],selected:number,title=this.title):void {
    this.title=title;
    const metadata=scenes.map(scene=>{
      const binding=this.bind(scene);
      binding.metadata=this.project.snapshot.scenes.find(row=>row.id===binding.metadata.id)??binding.metadata;
      return binding.metadata;
    });
    const selectedId=metadata[selected]?.id??null,current=this.project.snapshot;
    if(current.title===title&&current.selectedId===selectedId&&current.scenes.length===metadata.length&&metadata.every((row,i)=>row.id===current.scenes[i]?.id&&row.revision===current.scenes[i]?.revision))return;
    this.project.replace(title,metadata,selectedId);
  }
  setTitle(title:string):void {
    this.title=title;
    if(this.project.snapshot.title!==title)this.project.transact(current=>({...current,title}));
  }
  sceneId(scene:object):string|undefined {return this.bindings.get(scene)?.metadata.id}
}
