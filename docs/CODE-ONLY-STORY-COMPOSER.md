# Code-only prompt-to-story composer

This release adds the Arabic "إنشاء قصة بالنص" button to the existing editor. It is a finite, authored story library, not unrestricted language understanding or an external AI service.

## Supported requests

- Noah's flood: construction, onset, boarding, flood and recession at Al-Judi. No prophets or people are depicted. Boat shape and animal species are illustrative, not historical claims.
- Educational tree growth: seed, germination, roots/leaves, young tree and growing tree. This is not a claim that every plant becomes a tree, or that all species grow on the same schedule.
- Arabic or English topic aliases, 3–5 scenes, a total duration of 15–120 seconds, and child-friendly captions. Unsupported topics, mixed topics, ambiguous numbers and unsupported duration expressions are rejected. Other requested details, styles and colors are not supported, as the UI explains.
- Example: `اشرح طوفان نوح للأطفال في ٥ مشاهد خلال ٣٥ ثانية`
- Example: `اشرح نمو شجرة من بذرة للأطفال في ٥ مشاهد خلال ٣٠ ثانية`

The original Arabic captions are not Quran quotations. The UI links to the relevant source material and explains the limits of each template.

## Native editor integration

The optional compiler selects authored stages and semantic layers. The adapter renders each layer separately, writes its explicit pixel ownership and passes the resulting ElementDocument to the existing timeline. There is no learned segmentation step. Text stays with its Arabic dots and marks as a named layer. All analyzed foreground pixels must have an owner or composition fails without changing the project.

The result uses the existing full-color one-pass reveal, preview and export renderer. It is whiteboard drawing, not animal movement or water simulation. No narration is generated. Native project files contain the rendered sources and ownership masks, so reopening one does not require downloading the story library or its font. The editor still supports older projects, ordinary image import and attached narration.

Generation is a preview-only transaction. Add preserves the old scenes, title and audio. Start New asks for confirmation and first writes a recovery copy including audio. If the recovery write fails, replacement does not occur. A changed prompt invalidates its preview; a changed project revision prevents applying an older preview. Cancellation and loading failures do not alter project contents.

## Download and offline behavior

Only the small launcher is in the initial app shell. Composer code, subset Noto Naskh Arabic font and the chosen artwork family load on demand. Story files are excluded from installation precaching and from the optional inference-runtime preload. The launcher briefly waits for first-use cache activation to avoid missing the first requested pack. Where browser storage and the service worker are available, a used pack can generate new variants after an offline reload. An unused pack still needs an initial connection. Browser cache eviction or storage refusal can remove offline access.

The font's OFL license is shipped beside it. No model weights are added. The pre-existing optional inference runtime is unchanged and is not needed by this feature.

## Verification

- `npm run build` includes deterministic parser/subset tests and existing renderer, repository, import, export, offline and delivery contracts.
- Actual local browser flow: prompt, review, Add, native `.rasm` download, fresh-context reopen and real MP4 export for both families.
- Noah: 5 scenes, 51 named elements, 35 seconds. Tree: 5 scenes, 60 named elements, 30 seconds. Both actual exports were decoded as H.264, 1280×720, with frames inspected at every stage.
- Tested cancellation, unsupported input, failed pack download, edited prompts, stale project revision, append preservation, unavailable recovery storage and failed recovery writes. Replacement recovery preserved 8 old scenes and the attached WAV recording.
- Used tree pack generated three new scenes after a complete offline reload; a cold install cached no story/font/model files. Noah did not request plant artwork. Reopened project files did not request story assets.
- Narrow Chromium layouts checked at 320 and 390 CSS pixels, without horizontal overflow. The export share/retry/viewer/diagnostic panel was retested with simulated browser capabilities. This does not establish actual iPhone saving or sharing. Real iPhone acceptance remains unconfirmed.

See `RELEASE-PAUSE-HANDOFF.md` for the previous release's historical scope. This document supersedes its statement that no prompt composer exists. Other paused work remains paused.
