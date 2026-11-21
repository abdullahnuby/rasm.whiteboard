"""Start the RASM engine on loopback only."""

from __future__ import annotations

import os

import uvicorn

from .api import app


def _port_from_environment() -> int:
    raw_port = os.environ.get("RASM_ENGINE_PORT", "8765")
    try:
        port = int(raw_port)
    except ValueError as error:
        raise SystemExit("RASM_ENGINE_PORT must be an integer between 1024 and 65535.") from error
    if not 1024 <= port <= 65535:
        raise SystemExit("RASM_ENGINE_PORT must be between 1024 and 65535.")
    return port


def main() -> None:
    # Deliberately bind to loopback. LAN/public binding is not supported.
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=_port_from_environment(),
        access_log=False,
        log_level=os.environ.get("RASM_ENGINE_LOG_LEVEL", "info"),
    )


if __name__ == "__main__":
    main()
