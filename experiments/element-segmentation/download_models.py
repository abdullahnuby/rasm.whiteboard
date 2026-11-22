"""Explicit one-time public model download. Image inference never uses the network."""
from pathlib import Path
from urllib.request import urlopen
import hashlib

REVISION='0d3b403339b4674a82493d5e97964dd78089ddc8'
FILES={
 'mobile_sam_image_encoder.onnx':'580f5fb648ea1062c0aabc26217aed56921985f03f0cbbd852bba81d760cc749',
 'sam_mask_decoder_single.onnx':'93915fc7c993ab9d59ab8c9ccd3bce37f7509c81ab4150a74abd4d2abbd8570d',
}
root=Path(__file__).parent/'models';root.mkdir(exist_ok=True)
for name,expected in FILES.items():
 path=root/name
 if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest()==expected:
  print(name,'already verified');continue
 partial=path.with_suffix('.download')
 try:
  with urlopen('https://huggingface.co/Acly/MobileSAM/resolve/'+REVISION+'/'+name,timeout=60) as response,partial.open('wb') as output:
   digest=hashlib.sha256()
   while True:
    block=response.read(1024*1024)
    if not block:break
    output.write(block);digest.update(block)
  if digest.hexdigest()!=expected:raise RuntimeError('Model checksum mismatch: '+name)
  partial.replace(path);print(name,'downloaded and verified')
 finally:
  partial.unlink(missing_ok=True)
