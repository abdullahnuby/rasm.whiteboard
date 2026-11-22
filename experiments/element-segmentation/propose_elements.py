from pathlib import Path
import json,time,sys,argparse,hashlib
try:
 import resource
except ImportError:
 resource=None
import numpy as np
from PIL import Image,ImageDraw,ImageFont
import onnxruntime as ort
parser=argparse.ArgumentParser(description='Local mask-proposal experiment, not production semantic segmentation.')
parser.add_argument('image',type=Path)
parser.add_argument('--output',type=Path,default=Path('output'))
parser.add_argument('--model-dir',type=Path,default=Path(__file__).parent/'models')
parser.add_argument('--threads',type=int,default=4)
args=parser.parse_args()
root=args.model_dir;out=args.output;out.mkdir(parents=True,exist_ok=True);opts=ort.SessionOptions();opts.intra_op_num_threads=args.threads
encoder=ort.InferenceSession(str(root/'mobile_sam_image_encoder.onnx'),sess_options=opts,providers=['CPUExecutionProvider']);decoder=ort.InferenceSession(str(root/'sam_mask_decoder_single.onnx'),sess_options=opts,providers=['CPUExecutionProvider'])
image=Image.open(args.image).convert('RGB');w,h=image.size;scale=1024/max(w,h);pixels=np.array(image);resized=image.resize((round(w*scale),round(h*scale)),Image.Resampling.BILINEAR)
fg=np.linalg.norm((pixels.astype(float)-255)*np.array([.92,1,.92]),axis=2)>=26
start=time.perf_counter();embedding=encoder.run(None,{'input_image':np.array(resized,dtype=np.float32)})[0];encTime=time.perf_counter()-start
candidates=[];probes=0;decodeStart=time.perf_counter()
for y in np.linspace(h/18,h-h/18,9):
 for x in np.linspace(w/32,w-w/32,16):
  inputs={'image_embeddings':embedding,'point_coords':np.array([[[x*scale,y*scale],[0,0]]],np.float32),'point_labels':np.array([[1,-1]],np.float32),'mask_input':np.zeros((1,1,256,256),np.float32),'has_mask_input':np.zeros(1,np.float32),'orig_im_size':np.array([h,w],np.float32)}
  masks,scores,_=decoder.run(None,inputs);probes+=1;score=float(scores[0,0]);mask=masks[0,0]>0;area=int(mask.sum());ink=mask&fg;inkCount=int(ink.sum())
  if score<.85 or area<300 or area>w*h*.55 or inkCount<100:continue
  # Keep multiple scales as proposals. No semantic labels are inferred from this score.
  duplicate=False
  for previous in candidates:
   inter=np.count_nonzero(mask&previous['mask']);union=area+previous['area']-inter
   if inter/union>.85:duplicate=True;break
  if not duplicate:candidates.append({'mask':mask,'ink':ink,'area':area,'inkPixels':inkCount,'score':score,'point':[float(x),float(y)]})
 print('ROW',round(y),'probes',probes,'candidates',len(candidates),flush=True)
elapsed=time.perf_counter()-decodeStart;candidates.sort(key=lambda c:-c['inkPixels'])
font=ImageFont.load_default(size=16);sheet=Image.new('RGB',(1280,4*230+60),(244,239,236));draw=ImageDraw.Draw(sheet)
draw.text((12,8),'Automatic proposals, not accepted objects. Scores are model estimates, not measured accuracy.',fill=(37,31,33),font=font)
records=[]
for i,c in enumerate(candidates):
 white=np.full_like(pixels,255);white[c['ink']]=pixels[c['ink']];ys,xs=np.where(c['ink']);bounds=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
 if i<16:
  cropped=Image.fromarray(white).crop(bounds);cropped.thumbnail((300,185));x=(i%4)*320+(320-cropped.width)//2;y=(i//4)*230+80;sheet.paste(cropped,(x,y));draw.text(((i%4)*320+12,(i//4)*230+57),str(i+1)+' / score '+format(c['score'],'.2f'),fill=(37,31,33),font=font)
 Image.fromarray(white).save(out/('auto-object-'+str(i+1)+'.png'))
 records.append({k:v for k,v in c.items()if k not in ['mask','ink']});records[-1]['bounds']=bounds
sheet.save(out/'automatic-proposals.jpg',quality=93)
metrics={'encoderSeconds':encTime,'decoderSeconds':elapsed,'probes':probes,'candidateCount':len(candidates),'peakRSSMiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024 if resource and sys.platform.startswith('linux') else None,'candidates':records,'warning':'Grid point prompts, no hand-picked boxes. Mask proposals are not semantic instances or accepted timeline items. Scores are model predictions, not measured accuracy.'}
(out/'automatic-proposals.json').write_text(json.dumps(metrics,indent=2));print('RESULT',json.dumps({k:v for k,v in metrics.items()if k!='candidates'}),flush=True)
np.savez_compressed(out/'automatic-masks.npz',**{'mask_'+str(i+1):c['ink'] for i,c in enumerate(candidates)})

def mask_runs(mask):
 padded=np.concatenate(([False],mask.reshape(-1),[False])).astype(np.int8)
 changes=np.flatnonzero(np.diff(padded));return np.column_stack((changes[::2],changes[1::2]-changes[::2])).reshape(-1).tolist()
bundle={'format':'rasm-element-masks','version':1,'width':w,'height':h,'sourceSha256':hashlib.sha256(args.image.read_bytes()).hexdigest(),'proposals':[{'name':'Proposal '+str(i+1),'runs':mask_runs(c['ink'])}for i,c in enumerate(candidates)]}
(out/'element-masks.rasm.json').write_text(json.dumps(bundle,separators=(',',':')))
