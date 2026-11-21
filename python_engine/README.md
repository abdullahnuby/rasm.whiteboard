# RASM Python Engine — foundation 0.1

This package is the first isolated Python foundation for RASM. It is **not yet
connected to the browser editor** and does not replace the current TypeScript
Engine v2. The browser engine remains authoritative until each migrated
operation passes deterministic parity and real-project acceptance tests.

## Requirements

- Python 3.11 or newer
- Windows, macOS, or Linux

## Create an environment

Windows PowerShell:

~~~powershell
cd python_engine
py -3.12 -m venv .venv
.venv/Scripts/Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
~~~

macOS / Linux:

~~~bash
cd python_engine
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
~~~

## Run the local service

~~~bash
python -m rasm_engine
~~~

The service binds only to 127.0.0.1:8765. It exposes:

- GET /health — liveness and version information.
- GET /v1/capabilities — only the operations implemented by this package.

No project files are read or uploaded. No cross-origin access is enabled. The
service deliberately has no public/LAN bind option. Browser pairing, origin
allowlisting, request authentication, job submission, progress, cancellation,
and binary image transport will be implemented before the hosted editor is
allowed to invoke processing operations.

## Tests

~~~bash
python -m pytest
~~~

## Implemented in 0.1

- Deterministic 2D distance, bounds, polyline length, and iterative
  Ramer-Douglas-Peucker simplification.
- Local-only FastAPI process and versioned capability handshake.
- Automated Python unit and API tests.

## Not implemented yet

Image decoding, OpenCV segmentation, vector extraction, component ownership,
route planning, reveal scheduling, motion planning, export, project persistence,
and browser integration are intentionally not claimed by this foundation.
