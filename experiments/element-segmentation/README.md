# Local element-segmentation experiment

This is a reproducible proposal experiment. A review UI, independent element document/timeline and browser-local WASM worker are now integrated. The model still does not produce reliable accepted semantic elements without review. See ../../docs/REBUILD-CHECKPOINT.md.

The requirement is to extract real objects from a picture, preserve their original pixels and placement, draw each independently, and control their order. Rectangular draw regions and connected ink components do not satisfy it.

## Run

Use Python 3.10+ in a separate environment:

```sh
python -m pip install -r experiments/element-segmentation/requirements.txt
python experiments/element-segmentation/download_models.py
python experiments/element-segmentation/propose_elements.py input.jpg --output results
```

The explicit download step fetches 44,658,416 bytes of public ONNX model files, pinned to revision `0d3b403339b4674a82493d5e97964dd78089ddc8` of [Acly/MobileSAM](https://huggingface.co/Acly/MobileSAM), with SHA-256 verification. Weights are not included in the application or this source archive. Model redistribution terms still need review before packaging.

Inference runs locally with ONNX Runtime CPU. The proposal script has no network calls. It samples a fixed 16-by-9 point grid, filters masks using a predicted-quality threshold and removes near-duplicates. It does not use manually selected object boxes, a semantic detector, or generated replacement pixels.

Outputs include a source-hashed RLE bundle (`element-masks.rasm.json`) that the editor can import, masks, separate original-pixel extractions, a sheet of the 16 largest proposals and JSON measurements. Scores are uncalibrated model outputs, not probabilities or measured accuracy. They can exceed 1.0. The extraction uses a simple white-background foreground threshold and is not a lossless final compositor.

## Measured on the four supplied 1280x720 illustrations

| Input | Proposals retained | Embedding | Grid decoding | Peak Python RSS |
|---|---:|---:|---:|---:|
| Basmala and leaves | 19 | 1.20 s | 12.91 s | 509 MiB |
| Tree and flowers | 33 | 1.07 s | 12.22 s | 530 MiB |
| Seedling and roots | 20 | 1.29 s | 12.79 s | 512 MiB |
| Scale and cloud | 22 | 1.10 s | 13.37 s | 511 MiB |

These are four-thread desktop CPU measurements, not Windows or Android release benchmarks. Peak memory includes Python, the inference sessions, images and retained proposal masks.

Visual inspection found a complete tree, bushes and several plants among the tree-image proposals. Other proposals duplicate parts, omit stems, split the scale into pieces or omit Arabic dots and marks. The seedling was not consistently extracted as a single complete plant. Therefore the automatic results are **not ready to become accepted timeline items without review**.

## What the product still needs

- Sketch-aware proposals or adaptive prompts, followed by deduplication and a part/whole hierarchy.
- Text grouping that preserves the complete Arabic word or phrase and its dots and marks. Never regenerate Quranic text or replace it with OCR output.
- Further usability testing of the implemented review, merge/split/refinement and unassigned-pixels workflow. A score never silently approves a mask.
- Native-device acceptance of the implemented stable IDs, local mask assets, canvas placement, relative timing/order and shared renderer.
- Exact coverage and overlap tests. Reassembling accepted element layers and any unassigned source pixels must retain the source image, without inventing hidden pixels.
- An efficient local Windows/Android runtime, memory limits, cancellation and real-device benchmarks. The naive grid and retained-mask allocation are not a mobile performance solution.

## References

- [MobileSAM upstream](https://github.com/chaoningzhang/mobilesam): lightweight promptable masks and automatic mask-generation API.
- [ONNX Runtime mobile](https://onnxruntime.ai/docs/tutorials/mobile/): local execution, runtime/provider choices and device-specific measurement.
- [InkLayer project](https://inklayer.github.io/) and [implementation](https://github.com/miatang13/InkLayer): sketch-tuned proposals, SAM masks and overlap refinement. Its published multi-model CUDA pipeline is a reference, not a lightweight Android adapter.
- [InkLayer paper](https://dl.acm.org/doi/10.1145/3721238.3730606): documents the sketch-domain gap and remaining boundary artifacts.
- [SlimSAM](https://github.com/czg1225/SlimSAM): another compact mask-model candidate, not tested here.
- [SAM 3](https://github.com/facebookresearch/sam3/blob/main/README.md): stronger concept prompting, but its published 848M-parameter CUDA setup is not the lightweight baseline chosen for this experiment.
