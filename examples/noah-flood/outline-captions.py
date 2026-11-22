from pathlib import Path
import json
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
font_path='/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf'
data=Path(font_path).read_bytes();face=hb.Face(data);font=hb.Font(face);font.scale=(face.upem,face.upem);hb.ot_font_set_funcs(font)
tt=TTFont(font_path);glyphs=tt.getGlyphSet();order=tt.getGlyphOrder()
def outline(text,cx,baseline,size,maxwidth,color):
 b=hb.Buffer();b.add_str(text);b.guess_segment_properties();hb.shape(font,b);width=sum(p.x_advance for p in b.glyph_positions);scale=min(size/face.upem,maxwidth/width);x=0;paths=[]
 for info,pos in zip(b.glyph_infos,b.glyph_positions):
  pen=SVGPathPen(glyphs);glyphs[order[info.codepoint]].draw(pen)
  paths.append(f'<path d="{pen.getCommands()}" transform="translate({x+pos.x_offset} {-pos.y_offset})"/>');x+=pos.x_advance
 return f'<g fill="{color}" transform="translate({cx-width*scale/2:.3f} {baseline}) scale({scale:.6f} {-scale:.6f})">'+''.join(paths)+'</g>'
items={'s1-title': ('١. بناء السفينة', 640, 126, 112, 900, '#17633e'), 's1-detail': ('ألواح وأدوات بناء، تمهيدًا للنجاة', 640, 195, 44, 1040, '#5b6249'), 's2-title': ('٢. بداية الطوفان', 640, 126, 112, 900, '#17633e'), 's2-detail': ('المطر يشتد، والماء يتفجر من الأرض', 640, 195, 44, 1040, '#5b6249'), 's3-title': ('٣. الصعود إلى السفينة', 640, 126, 112, 900, '#17633e'), 's3-detail': ('أزواج من الحيوان تصعد مع بدء الطوفان', 640, 195, 44, 1040, '#5b6249'), 's4-title': ('٤. اشتداد الطوفان', 640, 126, 112, 900, '#17633e'), 's4-detail': ('السفينة تجري وسط أمواج هائلة', 640, 195, 44, 1040, '#5b6249'), 's5-title': ('٥. انحسار الماء', 640, 126, 112, 900, '#17633e'), 's5-detail': ('تتوقف الأمطار وتستقر السفينة على الجودي', 640, 195, 44, 1040, '#5b6249'), 'main-title': ('مراحل طوفان نوح', 640, 72, 64, 1100, '#17633e'), 'judi': ('الجودي', 640, 642, 41, 180, '#17633e'), 'note': ('تصوير توضيحي، لا يحدد شكل السفينة أو أنواع الحيوان تاريخيًا', 640, 701, 26, 1140, '#72745e'), 'source-title': ('تسلسل توضيحي مستند إلى', 320, 896, 34, 595, '#5b6249'), 'source-hud': ('سورة هود: ٣٧ إلى ٤٤', 320, 945, 34, 595, '#5b6249'), 'source-qamar': ('سورة القمر: ١١ و١٢', 320, 994, 34, 595, '#5b6249'), 'source-people': ('دون تجسيد الأنبياء أو الأشخاص', 320, 1043, 34, 595, '#5b6249'), 'source-design': ('شكل السفينة وأنواع الحيوان رمزية', 320, 1092, 34, 595, '#5b6249')}
result={key:{'caption':spec[0],'svg':outline(*spec)} for key,spec in items.items()}
(Path(__file__).parent/'assets/captions.json').write_text(json.dumps(result,ensure_ascii=False))
