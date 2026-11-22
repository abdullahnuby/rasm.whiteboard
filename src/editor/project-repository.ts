type JsonRecord = Record<string, unknown>;
interface AssetRef { readonly assetId: string; }
interface StoredProject { readonly storage: 'rasm-assets-v1'; readonly metadata: JsonRecord; }
interface AssetRow { readonly id: string; readonly blob: Blob; }
const record = (value: unknown): value is JsonRecord => typeof value==='object'&&value!==null&&!Array.isArray(value);
const assetRef = (value: unknown): value is AssetRef => record(value)&&typeof value.assetId==='string';
function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve,reject)=>{value.onsuccess=()=>resolve(value.result);value.onerror=()=>reject(value.error??new Error('Local database request failed.'));});
}
function completed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error??new Error('Local database transaction failed.'));});
}
const isStored = (value: unknown): value is StoredProject => record(value)&&value.storage==='rasm-assets-v1'&&record(value.metadata);

/** Content-addressed binary assets and metadata commit together in a single IDB transaction. */
export class ProjectRepository {
  private hashes = new WeakMap<Blob,Promise<string>>();
  private constructor(readonly database: IDBDatabase) {}
  static async open(name='rasm-studio', factory: IDBFactory=globalThis.indexedDB): Promise<ProjectRepository> {
    if(!factory) throw new Error('Local project storage is unavailable.');
    const opening=factory.open(name,2);
    opening.onupgradeneeded=()=>{
      const db=opening.result;
      if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects');
      if(!db.objectStoreNames.contains('assets'))db.createObjectStore('assets');
    };
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{
      let rejected=false;
      opening.onsuccess=()=>{if(rejected)opening.result.close();else resolve(opening.result)};
      opening.onerror=()=>{rejected=true;reject(opening.error??new Error('Could not open local project storage.'))};
      opening.onblocked=()=>{rejected=true;reject(new Error('Close other Rasm tabs before upgrading project storage.'))};
    });
    db.onversionchange=()=>db.close();
    return new ProjectRepository(db);
  }
  close(): void { this.database.close(); }
  private hash(blob: Blob): Promise<string> {
    let pending=this.hashes.get(blob);
    if(!pending){
      pending=blob.arrayBuffer().then(bytes=>crypto.subtle.digest('SHA-256',bytes)).then(digest=>'sha256-'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''));
      this.hashes.set(blob,pending);
    }
    return pending;
  }
  private async encode(value: unknown): Promise<{ stored:StoredProject; assets:AssetRow[] }> {
    if(!record(value)||value.format!=='rasm-studio'||!Array.isArray(value.scenes))throw new Error('Invalid project snapshot.');
    const assets:AssetRow[]=[];
    const add=async(value:unknown):Promise<AssetRef>=>{
      let blob:Blob;
      if(value instanceof Blob)blob=value;
      else if(typeof value==='string'&&value.startsWith('data:'))blob=await(await fetch(value)).blob();
      else throw new Error('Project contains an invalid image or audio asset.');
      const id=await this.hash(blob);assets.push({id,blob});return {assetId:id};
    };
    const metadata:JsonRecord={...value,scenes:[]};
    const scenes:JsonRecord[]=[];
    for(const row of value.scenes){
      if(!record(row))throw new Error('Invalid scene metadata.');
      const next:JsonRecord={...row,image:await add(row.image)};
      if(record(row.elements)&&record(row.elements.metadata))next.elements={metadata:row.elements.metadata,ownership:await add(row.elements.ownership)};
      scenes.push(next);
    }
    metadata.scenes=scenes;
    if(record(value.audio)){
      const {blob,data,...audio}=value.audio;
      metadata.audio={...audio,asset:await add(blob??data)};
    }
    if(value.hand)metadata.hand=await add(value.hand);
    return {stored:{storage:'rasm-assets-v1',metadata},assets};
  }
  async put(key:string,value:unknown,stillCurrent:()=>boolean=()=>true):Promise<boolean>{
    const {stored,assets}=await this.encode(value);
    if(!stillCurrent())return false;
    const tx=this.database.transaction(['projects','assets'],'readwrite');
    const done=completed(tx);
    for(const asset of assets)tx.objectStore('assets').put(asset.blob,asset.id);
    tx.objectStore('projects').put(stored,key);
    await done;return true;
  }
  async get(key:string):Promise<unknown>{
    const tx=this.database.transaction(['projects','assets'],'readonly'),done=completed(tx);
    const stored=await request(tx.objectStore('projects').get(key));
    if(!isStored(stored)){await done;return stored;}
    const rows=Array.isArray(stored.metadata.scenes)?stored.metadata.scenes:[];
    const references:AssetRef[]=[];
    for(const row of rows)if(record(row)&&assetRef(row.image))references.push(row.image);
    for(const row of rows)if(record(row)&&record(row.elements)&&assetRef(row.elements.ownership))references.push(row.elements.ownership);
    const audio=stored.metadata.audio;
    if(record(audio)&&assetRef(audio.asset))references.push(audio.asset);
    if(assetRef(stored.metadata.hand))references.push(stored.metadata.hand);
    // Queue every read before awaiting, so IndexedDB cannot auto-close this transaction.
    const assets=new Map<string,Blob>();
    await Promise.all(references.map(async ref=>{
      const blob=await request(tx.objectStore('assets').get(ref.assetId));
      if(!(blob instanceof Blob))throw new Error('Project asset is missing: '+ref.assetId);
      assets.set(ref.assetId,blob);
    }));
    await done;
    const result:JsonRecord={...stored.metadata,scenes:rows.map(row=>record(row)&&assetRef(row.image)?{...row,image:assets.get(row.image.assetId)}:row)};
    for(const row of result.scenes as unknown[]){if(record(row)&&record(row.elements)&&assetRef(row.elements.ownership))row.elements={...row.elements,ownership:assets.get(row.elements.ownership.assetId)}}
    if(record(audio)&&assetRef(audio.asset)){
      const {asset,...metadata}=audio;result.audio={...metadata,blob:assets.get((asset as AssetRef).assetId)};
    }
    if(assetRef(result.hand)){
      const blob=assets.get(result.hand.assetId)!;
      const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
      for(let start=0;start<bytes.length;start+=32768)binary+=String.fromCharCode(...bytes.subarray(start,start+32768));
      result.hand='data:'+blob.type+';base64,'+btoa(binary);
    }
    return result;
  }
  /** Preserve the exact stored record, including malformed legacy metadata, without decoding or re-encoding assets. */
  async preserve(sourceKey:string,recoveryKey:string):Promise<boolean>{
    if(!recoveryKey.startsWith('recovered-')||sourceKey===recoveryKey)throw new Error('Invalid recovery key.');
    const tx=this.database.transaction('projects','readwrite'),done=completed(tx),store=tx.objectStore('projects');
    const value=await request(store.get(sourceKey));
    if(value===undefined){await done;return false}
    store.put(value,recoveryKey);await done;return true;
  }
  async listRecoveries():Promise<Array<{key:string;value:unknown}>>{
    const tx=this.database.transaction('projects','readonly'),done=completed(tx);
    const store=tx.objectStore('projects');
    const keysRequest=request(store.getAllKeys()),valuesRequest=request(store.getAll());
    const [keys,values]=await Promise.all([keysRequest,valuesRequest]);await done;
    return keys.flatMap((key,index)=>typeof key==='string'&&key.startsWith('recovered-')?[{key,value:isStored(values[index])?values[index].metadata:values[index]}]:[]);
  }
  async remove(key:string):Promise<void>{
    const tx=this.database.transaction('projects','readwrite'),done=completed(tx);tx.objectStore('projects').delete(key);await done;
    await this.collectUnusedAssets();
  }
  /** Only delete binaries unreferenced by every saved project/recovery in the same transaction. */
  async collectUnusedAssets():Promise<void>{
    const tx=this.database.transaction(['projects','assets'],'readwrite'),done=completed(tx);
    const projects=await request(tx.objectStore('projects').getAll());
    const used=new Set<string>();
    const visit=(value:unknown):void=>{if(assetRef(value)){used.add(value.assetId);return;}if(Array.isArray(value))value.forEach(visit);else if(record(value))Object.values(value).forEach(visit)};
    projects.forEach(visit);
    await new Promise<void>((resolve,reject)=>{
      const cursor=tx.objectStore('assets').openCursor();cursor.onerror=()=>reject(cursor.error);
      cursor.onsuccess=()=>{const row=cursor.result;if(!row){resolve();return;}if(typeof row.key==='string'&&!used.has(row.key))row.delete();row.continue()};
    });
    await done;
  }
}
