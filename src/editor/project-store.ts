export interface Zone { readonly x: number; readonly y: number; readonly w: number; readonly h: number; }
export interface SceneSettings {
  readonly name: string;
  readonly duration: number;
  readonly speed: number;
  readonly motionStyle: 'smart' | 'contour';
  readonly elementDirection: 'rtl' | 'ltr';
  readonly revealMode?:'direct'|'outline-color';
  readonly mode: 'original' | 'ink' | 'color' | 'fill';
  readonly tone: number;
  readonly side: '1' | '-1';
  readonly hold: number;
  readonly paper: string;
  readonly transition: 'cut' | 'fade';
  readonly sourceHand: 'auto' | 'detect' | 'present' | 'clean';
  readonly handSize: number;
  readonly weight: number;
  readonly zones: readonly Zone[];
}
export interface SceneMetadata extends SceneSettings {
  readonly id: string;
  readonly assetId: string;
  readonly revision: number;
}
export interface ProjectState {
  readonly revision: number;
  readonly title: string;
  readonly scenes: readonly SceneMetadata[];
  readonly selectedId: string | null;
}
const copySettings = (settings: SceneSettings): SceneSettings => ({ ...settings, zones: settings.zones.map(zone => Object.freeze({ ...zone })) });
function validateScene(scene: SceneMetadata): void {
  if(scene.revealMode!==undefined&&!['direct','outline-color'].includes(scene.revealMode))throw Error('Invalid reveal mode.');
  if (!scene.id || !scene.assetId) throw new Error('Scene identity and image asset are required.');
  for (const key of ['duration','speed','hold','handSize','weight'] as const) {
    if (!Number.isFinite(scene[key])) throw new Error('Invalid scene setting: ' + key);
  }
  if(scene.duration<=0 || scene.speed<=0 || scene.hold<0 || scene.hold>70) throw new Error('Scene timing is outside its valid range.');
  if(!/^#[a-f\d]{6}$/i.test(scene.paper)) throw new Error('Invalid scene paper color.');
  for(const zone of scene.zones) {
    if(![zone.x,zone.y,zone.w,zone.h].every(v=>Number.isFinite(v)&&v>=0&&v<=1)) throw new Error('Invalid drawing zone.');
  }
}
function freezeState(state: ProjectState): ProjectState {
  if(state.scenes.length>300) throw new Error('Project scene limit exceeded.');
  const ids = new Set<string>();
  const scenes = state.scenes.map(scene => {
    validateScene(scene);
    if(ids.has(scene.id)) throw new Error('Duplicate scene identity.');
    ids.add(scene.id);
    const settings = copySettings(scene);
    return Object.freeze({ ...settings, id:scene.id, assetId:scene.assetId, revision:scene.revision, zones:Object.freeze(settings.zones) });
  });
  if(state.selectedId!==null&&!ids.has(state.selectedId)) throw new Error('Selected scene does not exist.');
  return Object.freeze({ ...state, scenes:Object.freeze(scenes) });
}

/** Metadata only: canvases, audio buffers and pixel arrays never live in project state. */
export class ProjectStore {
  private state: ProjectState = freezeState({ revision:0, title:'مشروع وايت بورد', scenes:[], selectedId:null });
  private listeners = new Set<(state: ProjectState) => void>();
  get snapshot(): ProjectState { return this.state; }
  subscribe(listener: (state: ProjectState) => void): () => void {
    this.listeners.add(listener); return () => this.listeners.delete(listener);
  }
  /** Validate a complete candidate before publishing anything. Failed edits leave state untouched. */
  transact(edit: (current: ProjectState) => Omit<ProjectState,'revision'>): ProjectState {
    const candidate=edit(this.state);
    const next=freezeState({ ...candidate, revision:this.state.revision+1 });
    this.state=next;
    for(const listener of this.listeners) listener(next);
    return next;
  }
  replace(title: string, scenes: readonly SceneMetadata[], selectedId: string | null): void {
    this.transact(()=>({title,scenes,selectedId}));
  }
  updateScene(id: string, update: Partial<SceneSettings>): void {
    if(!this.state.scenes.some(scene=>scene.id===id)) throw new Error('Scene no longer exists.');
    this.transact(current=>({ ...current, scenes:current.scenes.map(scene=>scene.id===id?{ ...scene,...update,revision:scene.revision+1 }:scene) }));
  }
  select(id: string | null): void { this.transact(current=>({ ...current,selectedId:id })); }
}
