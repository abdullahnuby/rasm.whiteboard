"""Local-only HTTP surface for the RASM Python engine foundation."""

from __future__ import annotations

import os
import platform
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

from . import API_VERSION, __version__


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "rasm-python-engine"
    engine_version: str = __version__
    api_version: str = API_VERSION
    python_version: str = platform.python_version()


class CapabilitiesResponse(BaseModel):
    service: str = "rasm-python-engine"
    engine_version: str = __version__
    api_version: str = API_VERSION
    ready: bool = True
    capabilities: list[str] = [
        "runtime.health",
        "runtime.capabilities",
        "geometry.distance",
        "geometry.bounds",
        "geometry.path-length",
        "geometry.simplify",
    ]
    cpu_count: int = max(1, os.cpu_count() or 1)
    processing_operations: list[str] = []


app = FastAPI(
    title="RASM Local Python Engine",
    version=__version__,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.get("/health", response_model=HealthResponse, include_in_schema=False)
def health() -> HealthResponse:
    """Read-only liveness endpoint; it does not expose project files."""
    return HealthResponse()


@app.get("/v1/capabilities", response_model=CapabilitiesResponse)
def capabilities() -> CapabilitiesResponse:
    """List only the operations implemented by this package."""
    return CapabilitiesResponse()
