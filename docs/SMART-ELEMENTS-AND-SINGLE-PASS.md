# Smarter local elements and one-pass source color

22 November 2026. Local checkpoint, not evidence of real iPhone acceptance.

## Product direction

New imports use source color in one pass. A separate sketch-then-color traversal is optional, not the default. The user's latest instruction supersedes the outline/color default introduced during the mobile export repair. Existing projects retain their saved style. The explicit apply-one-pass control changes reveal style without changing element order or duration. Switching to direct color also releases the active source's unused outline mask.

The canonical renderer, plan and source pixels are unchanged. Direct mode uses the same monotonic element schedule for the pen and revealed pixels. No AI recoloring, text rewriting or replacement image is introduced. Independent element ownership still prevents later elements appearing before their turn. Unassigned source ink remains preserved at the end.

## Local model workflow

Normal image import does not automatically run learned segmentation. The optional MobileSAM proposal worker now uses a sparse context grid plus foreground/component-aware prompts, rather than only a uniform 144-point grid. Mask stability and source-ink duplicate filtering help review; more candidates are not automatically better candidates. Small source details can now receive proposals, but automatic Arabic word grouping is not solved.

Interactive review supports positive points, negative points and a box. The source embedding is prepared once for that session; subsequent corrections reuse it. Masks stay proposals until accepted. Cancel, close, source changes and an idle interval release the worker. A session releases after about one minute without use, with its user-entered points retained for another preparation. Existing pixel brushes, split, merge and undo remain.

The text-box tool groups only existing source ink inside an explicitly drawn word/line region, including detached dots and marks. It is not OCR or automatic Arabic understanding. The user must avoid clipping marks or including a neighboring drawing.

## Installation and privacy

An explicit optional button downloads about 57 MB including inference runtime. It fetches the two existing MobileSAM ONNX exports from a pinned Acly/MobileSAM revision, checks their SHA-256 hashes and installs their bytes locally. Ordinary import does not download these weights. The previous manual-file import remains available. Neither model path sends image pixels, prompts or audio to a service. A model download necessarily contacts its hosting service; it uses no credentials and sends no referrer.

Model bytes are stored as ArrayBuffers, and the worker still reads older Blob model records. This avoids a reproduced Blob-write failure in the desktop WPE WebKit test environment. The shared project storage format was deliberately not changed for that environment-specific issue.

Pinned source: https://huggingface.co/Acly/MobileSAM , revision 0d3b403339b4674a82493d5e97964dd78089ddc8.

- mobile_sam_image_encoder.onnx: 580f5fb648ea1062c0aabc26217aed56921985f03f0cbbd852bba81d760cc749
- sam_mask_decoder_single.onnx: 93915fc7c993ab9d59ab8c9ccd3bce37f7509c81ab4150a74abd4d2abbd8570d

Original model project: https://github.com/ChaoningZhang/MobileSAM/ . ONNX exports are downloaded from their source, not added to this repository. Runtime and source licenses remain applicable.

## Measured comparison

Same four supplied illustrations, desktop Chromium, same source raster and learned model, candidate masks always reviewed:

| Image | Uniform-grid seconds | Targeted seconds | Targeted prompt count |
|---|---:|---:|---:|
| Calligraphy and corner ornaments | 28.0 | 14.4 | 66 |
| Tree and flowers | 28.2 | 19.8 | 96 |
| Plant and roots | 28.2 | 16.6 | 80 |
| Scales illustration | 27.9 | 15.0 | 67 |

For four isolated corner ornaments in the first image, best source-ink mask IoU rose from 0 to 0.20 with the uniform grid to 0.93 to 0.97 with targeted prompts. References were original foreground pixels inside manually selected isolated regions. This small, selected ornament test is not overall segmentation accuracy or an Arabic benchmark. Automatic results still include fragments and require review.

Desktop Chromium and desktop WebKit prepared an interactive image in about 4.1 to 4.3 seconds and applied the next correction in about 0.23 to 0.27 seconds. These are not phone timings.

On the four illustrations, one-pass cold frame rendering took about 3 to 13 ms versus 32 to 45 ms with outline-mask preparation in one desktop run. It avoided a 518,400-byte retained outline mask for the active 960x540 source. This is not total application memory. At the same requested six-second duration, both styles exported 144 frames at 24 fps, H.264 1280x720. No claim is made that encoding time or memory halves.

## Alternate model trial

SlimSAM-77 INT8 was downloaded to a separate trial, not installed in Rasm or selected as a replacement. Listed encoder/decoder weights total about 13.8 MB, but a native desktop CPU trial was terminated by SIGKILL during encoder inference, including a low-memory configuration. Sampling observed about 1.70 GiB process RSS before termination. Resource pressure is suspected, not proven from the exit status. No comparative mask-quality score was obtained. A small weight download is not a working-memory guarantee.

Candidate sources: https://github.com/czg1225/SlimSAM and https://huggingface.co/Xenova/slimsam-77-uniform/tree/main/onnx . Keep the current working model for this checkpoint.

## Verification and remaining limits

The full build and new pure-helper/single-pass renderer tests pass. Browser checks cover source-preserving text review, smart masks, negative corrections, acceptance, stable ownership, save/reload in Chromium, explicit download, cancellation, stale response guards, mobile layout, actual idle release, legacy migrations, element editing, offline model inference, first-use offline H.264 export and the seven-case export compatibility matrix.

Desktop WebKit successfully installs verified model ArrayBuffers and performs interactive prediction. Its WPE runtime rejects even a separate minimal IndexedDB Blob-write probe, so project Blob save/reload was not established there. That is not evidence that real iPhone Safari has the same failure. No real iPhone hardware, iOS memory ceiling or long-session thermal result is claimed. Keep .rasm backups and do not clear site data to update.
