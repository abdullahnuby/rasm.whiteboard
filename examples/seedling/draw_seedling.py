from pathlib import Path
import random, math, json
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
O=Path(__file__).parent;O.mkdir(exist_ok=True)
INK='#252a24';GREEN='#17633e';LEAF='#6eaa4d';GOLD='#e6ac29';SOIL='#e4b36a'
rng=random.Random(43);parts=[]
def p(d,fill='none',stroke=INK,w=4,extra=''):
 return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{w:.2f}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'
def group(id,label,body):
 parts.append(f'<g id="{id}" data-label="{label}">{body}</g>')
def title(text):
 fp='/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf';data=Path(fp).read_bytes();face=hb.Face(data);font=hb.Font(face);font.scale=(face.upem,face.upem);hb.ot_font_set_funcs(font);buf=hb.Buffer();buf.add_str(text);buf.guess_segment_properties();hb.shape(font,buf)
 t=TTFont(fp);gs=t.getGlyphSet();order=t.getGlyphOrder();width=sum(v.x_advance for v in buf.glyph_positions);scale=min(112/face.upem,1035/width);x=0;out=[]
 for info,pos in zip(buf.glyph_infos,buf.glyph_positions):
  pen=SVGPathPen(gs);gs[order[info.codepoint]].draw(pen);out.append(f'<path d="{pen.getCommands()}" transform="translate({x+pos.x_offset} {-pos.y_offset})"/>');x+=pos.x_advance
 return f'<g fill="{GREEN}" transform="translate({640-width*scale/2:.2f} 139) scale({scale} {-scale})">'+''.join(out)+'</g>'
soil='M235 523 Q253 515 269 521 Q281 514 297 521 Q312 513 329 519 Q346 511 364 518 Q380 510 395 518 Q410 509 428 516 Q447 509 465 517 Q482 508 501 516 Q521 510 540 517 Q561 509 578 516 Q600 510 620 516 Q639 509 660 516 Q683 511 701 518 Q720 510 740 518 Q761 513 779 520 Q800 512 819 519 Q840 513 860 522 Q880 515 898 523 Q920 517 940 525 Q962 519 984 527 Q1005 521 1028 530 L1060 537 Q1047 578 1019 604 Q990 628 954 635 Q931 657 897 660 Q874 685 841 682 Q801 710 756 700 Q711 724 670 709 Q620 724 575 710 Q529 722 489 704 Q445 713 405 689 Q367 691 340 669 Q301 665 282 634 Q250 623 245 591 Q226 568 225 542 Z'
left='M635 440 C626 393 609 351 576 321 C548 294 506 273 460 272 C443 272 428 278 410 280 C436 302 439 342 458 365 C487 401 529 402 567 405 C597 407 622 418 635 440 Z'
right='M642 447 C651 408 673 377 709 357 C744 337 786 341 822 325 C817 356 803 388 781 406 C746 437 708 419 677 435 C658 445 649 455 641 475 Z'
defs=f'<defs><clipPath id="soilClip">{p(soil,"white","none",0)}</clipPath><clipPath id="leftClip">{p(left,"white","none",0)}</clipPath><clipPath id="rightClip">{p(right,"white","none",0)}</clipPath></defs>'
# Caption is original neutral Arabic, not a reproduced religious quotation.
group('caption','عنوان عربي',title('بذرة صغيرة، حياة كبيرة'))
group('caption-accents','علامات حول العنوان',p('M168 106 Q148 99 137 89 Q151 87 171 99 Z',GOLD,'none',0)+p('M165 122 Q142 123 128 116 Q146 111 165 116 Z',GOLD,'none',0)+p('M1111 99 Q1130 82 1147 83 Q1138 99 1118 107 Z',GOLD,'none',0)+p('M1115 119 Q1140 108 1157 113 Q1141 126 1119 126 Z',GOLD,'none',0)+p('M301 177 C461 155 737 195 979 167','none',GOLD,8))
group('soil-base','قطاع التربة',p(soil,SOIL,'none',0))
texture=[]
for i in range(230):
 x=rng.uniform(233,1050);y=rng.uniform(527,715);a=rng.uniform(.1,.23);length=rng.uniform(1.5,9)
 texture.append(p(f'M{x:.1f} {y:.1f} l{length:.1f} {-length*.35:.1f}','none',rng.choice(['#fff0be','#a57337','#b78344']),rng.uniform(.65,1.45),f'opacity="{a:.2f}"'))
# A few flowing strata instead of a dense noise filter.
texture.append(p('M256 551 C392 541 507 556 616 546 M729 553 Q883 546 1018 555 M291 604 Q406 622 501 613 M760 644 Q862 657 932 629','none','#c68d46',1.8,'opacity=".5"'))
group('soil-texture','نسيج خفيف للتربة','<g clip-path="url(#soilClip)">'+''.join(texture)+'</g>')
group('soil-edge','حافة التربة',p('M231 532 Q250 523 269 529 Q285 520 303 528 Q319 520 337 526 Q353 517 371 524 Q390 517 406 523 Q427 514 446 522 Q466 515 486 522 Q506 515 526 522 Q546 515 567 522 Q589 514 611 522 Q634 517 655 522 Q677 516 697 524 Q720 517 740 524 Q759 519 779 527 Q801 519 821 526 Q842 522 864 529 Q885 522 906 529 Q925 524 947 532 Q971 526 990 535 Q1013 529 1045 539','none',INK,5.2)+p('M253 544 Q279 533 301 542 T351 538 T405 539 T460 537 T517 540 T571 538 M753 542 Q797 534 841 543 T920 546 T1021 547','none',INK,1.8))
# Root structure: outlined cream silhouettes with tapered terminal offshoots.
roots=[('M639 517 C638 548 631 572 620 594 C604 621 608 653 606 694',20,3),('M635 544 C608 555 584 559 559 569 C532 580 508 582 481 604 L462 623',12,2.5),('M624 573 C596 579 576 594 558 611 C544 624 525 630 507 639',9,2),('M615 612 C588 620 576 641 566 663 L552 680',7,1.7),('M637 544 C663 558 682 564 708 570 C736 579 755 592 777 612 L794 629',12,2.5),('M646 572 C665 596 688 604 704 629 C715 645 732 654 751 664',9,2),('M650 610 C663 631 664 651 677 670 L691 688',7,1.6)]
from shapely.geometry import Polygon
from shapely.ops import unary_union
curves=[
 ((639,534),(635,587),(602,629),(607,697),16),
 ((635,547),(594,565),(514,566),(458,623),12),
 ((623,576),(585,584),(557,624),(505,640),9),
 ((611,613),(583,630),(576,658),(550,683),7),
 ((640,545),(684,570),(737,570),(795,630),12),
 ((643,573),(662,610),(707,635),(752,665),9),
 ((640,611),(665,630),(661,663),(694,692),7),
 ((528,578),(516,569),(491,571),(480,566),4),
 ((479,604),(463,601),(448,606),(430,618),3),
 ((561,610),(549,597),(535,596),(519,603),4),
 ((529,631),(510,646),(499,651),(481,657),3),
 ((577,653),(584,658),(588,673),(586,681),3),
 ((609,672),(620,680),(631,684),(630,700),3),
 ((706,570),(720,554),(737,560),(751,553),4),
 ((756,593),(773,582),(789,591),(805,587),3),
 ((706,638),(726,629),(741,643),(760,640),3),
 ((674,668),(665,679),(668,691),(657,702),3),
 ((617,596),(631,602),(635,615),(648,621),3)]
polys=[]
for a,b,c,d,w in curves:
 points=[]
 for i in range(40):
  t=i/39;u=1-t;x=u**3*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t**3*d[0];y=u**3*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t**3*d[1]
  dx=3*u*u*(b[0]-a[0])+6*u*t*(c[0]-b[0])+3*t*t*(d[0]-c[0]);dy=3*u*u*(b[1]-a[1])+6*u*t*(c[1]-b[1])+3*t*t*(d[1]-c[1]);n=math.hypot(dx,dy);r=max(.12,w/2*(1-t)**.8)*(1+.06*math.sin(t*17))
  points.append(((x-dy/n*r,y+dx/n*r),(x+dy/n*r,y-dx/n*r)))
 polys.append(Polygon([z[0] for z in points]+[z[1] for z in reversed(points)]))
shape=unary_union(polys).simplify(.25);shapes=list(shape.geoms) if hasattr(shape,'geoms') else [shape];rbody=''
for sh in shapes:
 coords=list(sh.exterior.coords);d='M'+' L'.join(f'{x:.2f} {y:.2f}' for x,y in coords)+' Z'
 rbody+=p(d,'#f7e8b9',INK,2.2)
group('roots','الجذور وفروعها',rbody)
pebbles=''
for x,y,s in [(304,567,5),(348,591,6),(401,565,4),(440,590,5),(338,628,3),(396,649,6),(458,663,4),(811,588,5),(866,568,4),(900,595,6),(951,567,3),(845,632,4),(781,673,3),(492,552,3)]:
 pebbles+=p(f'M{x-s} {y} q1 {-s} {s} {-s*.8} q{s} -1 {s*1.2} {s*.8} q0 {s} {-s} {s*.7} q{-s} 1 {-s*1.2} {-s*.7} Z','#cca05c','#675332',1.9)
group('soil-pebbles','حبيبات وأحجار صغيرة',pebbles)
group('stem','الساق',p('M627 521 C630 482 634 452 625 419 C620 396 609 383 596 370 L603 364 C625 383 640 402 643 426 C649 407 665 390 686 376 L692 383 C662 404 652 427 649 454 L642 520 Z','#75a64a',INK,3.8))
group('left-leaf','الورقة اليسرى',p(left,LEAF,INK,4.6)+p('M419 281 C455 280 484 289 509 306 C478 298 452 297 435 298 Z','#9fc96b','none',0)+p('M454 363 C494 386 537 381 567 392 C597 403 620 415 631 431 C602 412 565 412 539 408 C499 403 474 390 454 363 Z','#559447','none',0))
group('right-leaf','الورقة اليمنى',p(right,'#79af50',INK,4.6)+p('M660 430 C700 393 763 360 813 335 C799 360 788 369 774 377 C736 398 704 403 679 422 Z','#95bf63','none',0))
veins=p('M628 425 C590 377 541 330 455 292 M646 442 C692 391 742 367 799 340','none','#273f29',3)
veins+=p('M587 379 Q562 373 539 375 M564 355 Q543 344 516 344 M539 333 L520 309 M599 393 Q596 362 582 343 M574 364 L564 336 M614 414 L610 387 M677 414 Q709 412 733 401 M699 390 Q704 369 716 358 M723 376 L744 376 M756 360 L766 345','none','#324c2b',2.1)
group('leaf-veins','عروق الأوراق',veins)
# Small deterministic pencil marks, not an image texture or SVG turbulence filter.
for ident,clip,xa,xb,ya,yb in [('left-grain','leftClip',421,634,280,433),('right-grain','rightClip',645,820,330,442)]:
 marks=[]
 for i in range(70):
  x=rng.uniform(xa,xb);y=rng.uniform(ya,yb);l=rng.uniform(3,13);marks.append(p(f'M{x:.1f} {y:.1f} l{l:.1f} {-l*.35:.1f}','none','#e2edbc',rng.uniform(.6,1.4),f'opacity="{rng.uniform(.1,.23):.2f}"'))
 group(ident,'علامات خفيفة على الأوراق','<g clip-path="url(#'+clip+')">'+''.join(marks)+'</g>')
seed=p('M638 513 C622 496 601 486 584 492 C565 500 566 523 577 534 C591 548 617 544 638 529 C655 543 680 541 688 526 C699 506 677 490 658 493 C647 494 642 504 638 513 Z',GOLD,INK,4.4)+p('M638 513 C626 509 609 506 580 500 M639 517 Q661 504 683 507','none',INK,2.4)+p('M582 526 Q599 540 625 525 M649 526 Q671 535 681 520','none','#f4d67a',3.3)
group('seed','البذرة',seed)
drops=''
for x,y,s in [(479,222,1.0),(553,201,.85),(632,235,.85),(716,201,1),(790,229,.8),(538,265,.65),(745,281,.6)]:
 drops+=f'<g transform="translate({x} {y}) rotate(21) scale({s})">'+p('M0 -29 C-3 -10 -13 7 -10 16 C-7 25 4 24 8 16 C12 8 4 -11 0 -29 Z','#e5efe0',GREEN,2.5)+p('M-5 10 Q-7 16 -2 18','none','white',2.5)+'</g>'
group('rain','قطرات المطر',drops)
accent=''
for x,y,angle,length in [(389,378,212,39),(387,403,184,36),(397,426,159,36),(853,377,-32,38),(857,403,-7,36),(849,426,19,35)]:
 accent+=f'<g transform="translate({x} {y}) rotate({angle})">'+p(f'M0 0 C9 -7 {length-4} -8 {length} 0 C{length-8} 7 9 6 0 0 Z',GOLD,'none',0)+'</g>'
group('growth-accents','إشارات النمو',accent)
svg='<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">'+defs+'<rect width="1280" height="720" fill="#fff"/>'+''.join(parts)+'</svg>'
(O/'seedling-ink.svg').write_text(svg)
(O/'build-info.json').write_text(json.dumps({'groups':len(parts),'bytes':len(svg.encode()),'caption':'بذرة صغيرة، حياة كبيرة','text':'Noto Naskh Arabic Bold shaped with HarfBuzz and converted to paths; no runtime font dependency','source':'Original hand-authored vector drawing with bounded seeded marks, not traced raster'},ensure_ascii=False,indent=2))
print(len(parts),'groups',len(svg.encode()),'bytes')
