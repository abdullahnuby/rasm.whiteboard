# Noah's flood: five authored whiteboard stages

Original code-authored illustrations in the reviewed green/gold ink style. No image model, generation API, embedded reference image, runtime font, SVG filter effect or network request is needed to render the SVG artwork.

## Open the editable animation

In Rasm, choose إدارة المشروع, then فتح نسخة محفوظة, and select `noah-flood.rasm`. Do not import that file through the image picker. It contains five ordered scenes, 51 named semantic elements and a 35-second timeline. Each scene's length and each element's order/relative drawing time can be edited in the existing tool. The MP4 is the actual exported 1280×720, 24 fps, H.264 result. It is silent.

The animation is the tool's full-color, single-pass whiteboard reveal with the marker-hand overlay. It is not walking animals, simulated rain, moving waves or 3D animation. The underlying drawing files remain SVG. For compatibility with the current app, the .rasm project stores raster images and explicit pixel-ownership masks derived from the authored SVG groups. A model was not used to guess or separate the elements. The current app does not directly import arbitrary SVG vectors as native paths.

## Sequence and sources

1. Building the ark. Hud 11:37-38: https://quran.com/hud/37
2. Rain and springs begin. Al-Qamar 54:11-12: https://quran.com/54/11-12
3. Pairs boarding at the onset. Hud 11:40-41: https://quran.com/hud/40-44
4. The intensifying flood and immense waves. Hud 11:42-43: https://quran.com/hud/40-44
5. Rain ceases, water recedes, the ark rests on Al-Judi. Hud 11:44: https://quran.com/hud/44

These are five explanatory panels, not a claim of an exact minute-by-minute chronology. The onset and boarding overlap in the source account. No people or prophets are depicted in the artwork. Sheep, goats, birds, tools, hull and cabin architecture are illustrative choices. No claim is made about the ark's exact historical appearance, dimensions, number of decks, geographical coordinates or the animal species aboard. The stage captions are original Arabic explanations, not verse reproductions. This is a selection of key stages, not the entire religious narrative.

## Files and source

- Five separate SVGs preserve named semantic subgroups for caption, explanation, ark, animals, clouds, rain, springs, water, ground and other elements.
- `noah-storyboard.svg` preserves the five stages as top-level named groups in one image.
- `noah-scenes.mjs` composes the scenes from reusable code; `ink-primitives.mjs` contains the ink, grain, leaf, rain and grouping functions.
- `assets/captions.json` contains correctly shaped Noto Naskh Arabic glyph outlines. There is no font dependency when viewing the SVGs.
- `node build.mjs` rebuilds the SVGs and manifests with no package dependencies.
- To change the baked captions, `outline-captions.py` requires authoring-only Python packages fontTools and uharfbuzz, plus Noto Naskh Arabic Bold at the path in that file. Its font license is included.

## Verified scope

The .rasm file was opened through the unchanged app's actual project-file picker in a fresh desktop Chromium session. All five scenes and all 51 timeline elements survived the round trip. Every analyzed foreground pixel had authored ownership, and every foreground pixel was present with its original color in the completed reveal buffers. The actual MP4 export was decoded and its frames inspected across all five stages. This is desktop verification, not a real iPhone save/share test. No production deployment or repository change was made for this project.
