# RASM Studio 5.2.3 QA Report

## Observations addressed from the 5.2.2 mobile screenshot
- Closely aligned component bounding boxes could be merged even when the objects were visually separate. This could place a nearby word/object into the same drawable group as a cloud or badge.
- OpenCV segmentation uses 8-connectivity, while the raster reveal flood fill used only 4-connectivity. Pixels connected only diagonally were left unvisited and assigned the terminal reveal time, causing fragments to appear at the end of an element rather than along its reveal.

## Fixes
- Component groups now merge only when a small mark passes the diacritic attachment tests, a component is nested inside an enclosing outline, or masks overlap substantially in both axes.
- Bounding-box proximity/projection overlap alone no longer merges neighbouring visual elements.
- Raster reveal now uses 8-neighbour connectivity, matching the connected-component topology used by OpenCV.
- For a component with no centerline route, the motion engine now uses contour paths from the same raster component. If no contour path exists either, it generates a short sweep within that component's own bounds. This prevents labelled image elements from having no hand movement and being revealed only at the scene end.
- Nested content inside a cloud/speech bubble/badge is grouped with its enclosing outline; nearby external text and illustrations remain independent elements.

## Regression tests
- Nested visual component inside an enclosing outline groups with that outline.
- Adjacent external object remains a separate group.
- Detached small aligned marks still attach to their base.
- Diagonally connected pixels reveal during the owning element interval, rather than as terminal leftovers.
- Existing two-element worker test still checks element completion timing and hand arrival.
- Existing shape segmentation, directional routing, image/schedule workers, reliability, timeline, export, and server resource tests remain in the build.

## Validation boundary
- All tests are synthetic geometric fixtures. The exact user illustration file (.rasm or original image) was not attached, so this does not constitute scene-specific visual acceptance.
- Final acceptance still requires opening the same project in the new preview and checking the same moment around 00:07. Safari/iPhone playback and export must be checked before production merge.
