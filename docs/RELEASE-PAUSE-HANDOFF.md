# Browser release and pause handoff

Date: 22 November 2026

> Historical handoff for the earlier release. The resumed code-only composer is described in [CODE-ONLY-STORY-COMPOSER.md](CODE-ONLY-STORY-COMPOSER.md); its scope supersedes the no-generator statement below.

## Released application

The live browser app is https://rasmwhiteboard.vercel.app/ . The release carries the tested app behavior from commit `f5da0f36e85b388f94a18cfff0587f67510d2131`, including the full-color single-pass reveal and the later export-delivery repair: share from a fresh user click, file capability checks, a visible viewer fallback, retained previous downloads and on-screen export diagnostics. The current example/documentation commit does not change application runtime code, optional models, offline resources or automatic cache size.

New source examples are under `examples/`, outside `dist/`:
- The reviewed seedling SVG and its authoring source.
- Five Noah flood stages, 51 named authored groups, the single SVG storyboard and the editable native `.rasm` project.

There is no new unrestricted text-to-image feature or automatic generator UI in this release. No unreviewed diverse-library drawings are included.

## Noah example verification

The native `.rasm` file was reopened through the unchanged app's actual project-file input in fresh desktop Chromium. It produced five ordered scenes of seven seconds each and 51 editable timeline elements. Foreground ownership had no unassigned pixels. Completed reveal buffers retained every analyzed foreground pixel and its original color. The real app export decoded as a silent 35-second H.264 MP4, 1280 by 720 at 24 fps. Frames from all five stages were visually checked.

The animation is a whiteboard reveal with the tool's marker-hand overlay, not animal movement or water simulation. For current app compatibility, the project stores raster images and explicit semantic ownership masks generated from authored SVG groups. The source SVGs remain editable separately; this is not native SVG-path editing inside the app.

Read `examples/noah-flood/README.md` for the sources and illustrative limits of the religious narrative.

## Paused and unconfirmed

- Real iPhone export/save/share acceptance is still unconfirmed. Desktop Chromium and simulated share responses do not establish that the actual iOS share sheet saved a file. The user should retest a short export on the phone and use the visible diagnostics if it fails.
- A real user narration/Voice Memos sample has not yet been tested. Synthetic WAV, MP3, AAC/M4A, Ogg/Opus and FLAC fixtures passed the earlier import audit, including save/restore and an exported audio track. Duration fitting is proportional across scenes, not speech-to-scene alignment.
- Diverse library work has local education/person, health/place, nature and symbolic-path studies. These have not been accepted or integrated and are not shipped here. The first rejected geometric demo is not a quality baseline.
- More expressive ink/grain refinement, a general reusable library UI and native vector timeline support remain future work.
- Native Windows/Android wrappers remain paused. The browser/PWA is the available product.

## Restart checklist

1. Recover the user's current priorities before resuming development.
2. Confirm actual iPhone save/share behavior with a short export, without claiming a fix has been accepted.
3. If audio sync is in scope, use the real narration file and distinguish duration matching from semantic sync.
4. Review diverse-library work visually by category before integrating it.
5. Keep original pixels, original colors in one pass, named independent elements, backward-compatible `.rasm` handling and the shared preview/export renderer.
6. Run the complete build and relevant browser import/export checks before any new release.
