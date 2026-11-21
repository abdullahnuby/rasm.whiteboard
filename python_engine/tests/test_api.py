from fastapi.testclient import TestClient

from rasm_engine.api import app

client = TestClient(app)


def test_health_endpoint_reports_local_engine_version():
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "rasm-python-engine"
    assert payload["api_version"] == "v1"


def test_capabilities_only_lists_implemented_operations():
    response = client.get("/v1/capabilities")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ready"] is True
    assert "geometry.simplify" in payload["capabilities"]
    assert payload["processing_operations"] == []


def test_interactive_api_documentation_is_not_exposed_by_default():
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
