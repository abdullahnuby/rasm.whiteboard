Rasm ink-style study, one scene

This is a new original vector illustration made in code against the supplied seedling reference's visual style. It is not a traced or embedded copy. It is a visual direction checkpoint, not a new general text-to-image generator and not a production app update.

seedling-ink.svg is the editable, self-contained artwork at 1280 by 720. It has 16 named groups for caption, accents, leaves, veins, stem, seed, roots, rain, soil and small marks. It contains paths, not embedded images, runtime fonts, scripts or SVG filter effects. The PNG is a raster preview of that actual SVG. reference-vs-code.png places the supplied reference beside the new artwork without altering the reference. The reference is not embedded in the SVG.

The new original neutral caption is: بذرة صغيرة، حياة كبيرة
It uses Noto Naskh Arabic Bold glyph outlines, shaped properly and converted to paths. It does not reproduce the Quranic text in the reference. This particular caption is precomposed, not an arbitrary dynamic calligraphy engine. Font license is included.

Design changes from the rejected first demo: organic leaf silhouettes and veins, irregular soil rim and cutaway, tapered branching root silhouettes, grain and pebble marks, gold growth accents, narrow dark-green rain drops and a restrained green/gold/earth palette on white. The drawing is still cleaner and less painterly than the reference. The user's visual judgment is the acceptance test.

Rebuilding the SVG from draw_seedling.py requires Python plus fontTools, uharfbuzz and shapely, and the Noto Naskh Arabic Bold font at the path named in that source. These are authoring dependencies only. Opening or rendering the final SVG needs none of them. Random detail placement has a fixed seed. No generative model or image API was used.
