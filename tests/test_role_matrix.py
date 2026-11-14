"""Who may do what, checked through the real API routes (FastAPI dependencies included).

Admin: everything, including every data change. Analyst: analysis tools (AI analyst, forecasts).
Viewer: read-only dashboards. Company 999999 does not exist, so an ALLOWED call ends in 404/422,
never 403; a FORBIDDEN call is stopped with 403 before the handler runs.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import get_current_user
from app.main import app

MISSING = 999999

CALLS = {
    "read companies": ("GET", "/companies/", None),
    "read kpis": ("GET", f"/companies/{MISSING}/kpis", None),
    "read analytics": ("GET", f"/companies/{MISSING}/analytics", None),
    "ai analyst": ("POST", f"/companies/{MISSING}/ai-analysis", {"question": "revenue?", "history": []}),
    "forecast": ("POST", f"/companies/{MISSING}/forecast", {"metric_name": "revenue", "periods": 3}),
    "create company": ("POST", "/companies/", {"name": ""}),  # blank name: 422 once past the role check
    "edit company": ("PUT", f"/companies/{MISSING}", {"industry": "x"}),
    "add kpi": ("POST", f"/companies/{MISSING}/kpis", {"metric_name": "revenue", "metric_value": 1, "metric_date": "2025-01-01"}),
    "edit kpi": ("PUT", f"/kpis/{MISSING}", {"metric_value": 1}),
    "import csv": ("POST", f"/companies/{MISSING}/kpis/import", {"csv": "period,revenue\n2025-01,1"}),
    "delete kpi": ("DELETE", f"/kpis/{MISSING}", None),
    "delete company": ("DELETE", f"/companies/{MISSING}", None),
}

ALLOWED = {
    "admin": set(CALLS),
    "analyst": {"read companies", "read kpis", "read analytics", "ai analyst", "forecast"},
    "viewer": {"read companies", "read kpis", "read analytics"},
}


@pytest.fixture
def client_as():
    def make(role: str) -> TestClient:
        app.dependency_overrides[get_current_user] = lambda: {"user_id": 0, "role": role}
        return TestClient(app)

    yield make
    app.dependency_overrides.clear()


@pytest.mark.parametrize("role", ["admin", "analyst", "viewer"])
@pytest.mark.parametrize("action", list(CALLS))
def test_role_matrix(client_as, role, action):
    method, url, body = CALLS[action]
    response = client_as(role).request(method, url, json=body)
    if action in ALLOWED[role]:
        assert response.status_code != 403, f"{role} should be allowed to {action}"
    else:
        assert response.status_code == 403, f"{role} must not be allowed to {action} (got {response.status_code})"
