"""API tests for POST /companies/{company_id}/ai-analysis (C1), incl. SPEC E20.

Uses the real auth (JWT for temporary test users) and the real DB; the LLM is faked.
Test users and their ai_insights rows are deleted afterwards.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.ai import llm
from app.ai.llm import LLMReply
from app.core.roles import UserRole
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.ai_insight import AIInsight
from app.models.user import User


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture
def users(db):
    created = {}
    for role in (UserRole.ADMIN, UserRole.VIEWER):
        user = User(
            email=f"ai-test-{role.value}-{uuid.uuid4().hex[:8]}@example.test",
            hashed_password=hash_password("not-used"),
            role=role,
            is_active=True,
        )
        db.add(user)
        db.commit()
        created[role.value] = user
    yield created
    db.rollback()
    for user in created.values():
        db.query(AIInsight).filter(AIInsight.user_id == user.id).delete()
        db.delete(user)
    db.commit()


def auth(user) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


@pytest.fixture
def fake_llm(monkeypatch):
    monkeypatch.setattr(llm, "prompt_guard_score", lambda text: 0.001)

    def reply(messages, **kwargs):
        return LLMReply(text="Revenue in March 2025 was 82,97,362 INR [F1].", model="fake-model", latency_ms=1)
    monkeypatch.setattr(llm, "chat", reply)


URL = "/companies/{}/ai-analysis"


def test_answer_keeps_old_fields_adds_new_ones_and_logs(client, db, users, fake_ids, fake_llm):
    company_id = fake_ids["Test Retail Pvt Ltd"]
    response = client.post(
        URL.format(company_id),
        json={"question": "What was revenue in March 2025?"},
        headers=auth(users["viewer"]),
    )
    assert response.status_code == 200
    body = response.json()

    # Vaibhav's original fields
    assert body["company_id"] == company_id
    assert body["question"] == "What was revenue in March 2025?"
    assert body["answer"] == "Revenue in March 2025 was 82,97,362 INR [F1]."
    # Added fields (SPEC §7)
    assert body["status"] == "answered"
    assert body["is_grounded"] is True
    assert body["sources"][0] == {"id": "F1", "type": "kpi", "label": "Revenue, March 2025"}
    assert body["figures"][0]["value"] == 8297362
    assert body["generated_at"].endswith("Z")

    row = db.get(AIInsight, body["insight_id"])
    assert row.user_id == users["viewer"].id
    assert row.company_id == company_id
    assert row.status == "answered"
    assert row.model == "fake-model"
    assert row.intent == "I1"
    assert row.latency_ms is not None


def test_refusal_is_200_with_status_and_logged(client, db, users, fake_ids, fake_llm):
    response = client.post(
        URL.format(fake_ids["Test Retail Pvt Ltd"]),
        json={"question": "Who won the IPL?"},
        headers=auth(users["admin"]),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "out_of_scope"
    assert db.get(AIInsight, body["insight_id"]).guard_reason == "off_topic"


def test_follow_up_history_is_accepted(client, users, fake_ids, monkeypatch):
    monkeypatch.setattr(llm, "prompt_guard_score", lambda text: 0.001)
    seen = {}

    def reply(messages, **kwargs):
        seen["roles"] = [m["role"] for m in messages]
        return LLMReply(text="Revenue in April 2025 was 1,13,72,251 INR [F1].", model="fake", latency_ms=1)
    monkeypatch.setattr(llm, "chat", reply)

    response = client.post(
        URL.format(fake_ids["Test Retail Pvt Ltd"]),
        json={
            "question": "And in April?",
            "history": [
                {"role": "user", "content": "What was revenue in March 2025?"},
                {"role": "assistant", "content": "Revenue in March 2025 was 82,97,362 INR."},
            ],
        },
        headers=auth(users["viewer"]),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "answered"
    assert seen["roles"] == ["system", "user", "assistant", "user"]


def test_missing_company_is_404(client, users, fake_llm):
    response = client.post(URL.format(10**9), json={"question": "Revenue?"}, headers=auth(users["admin"]))
    assert response.status_code == 404
    assert response.json() == {"detail": "Company not found"}


def test_llm_down_is_503_and_logged_as_error(client, db, users, fake_ids, monkeypatch):
    monkeypatch.setattr(llm, "prompt_guard_score", lambda text: 0.001)

    def down(messages, **kwargs):
        raise llm.LLMError("All models failed: timeout")
    monkeypatch.setattr(llm, "chat", down)

    response = client.post(
        URL.format(fake_ids["Test Retail Pvt Ltd"]),
        json={"question": "What was revenue in March 2025?"},
        headers=auth(users["admin"]),
    )
    assert response.status_code == 503
    assert response.json() == {"detail": "AI service is temporarily unavailable"}

    row = (
        db.query(AIInsight)
        .filter(AIInsight.user_id == users["admin"].id)
        .order_by(AIInsight.id.desc())
        .first()
    )
    assert row.status == "error" and "timeout" in row.error


def test_blank_question_is_400_and_too_long_is_422(client, users, fake_ids, fake_llm):
    url = URL.format(fake_ids["Test Retail Pvt Ltd"])
    assert client.post(url, json={"question": "   "}, headers=auth(users["admin"])).status_code == 400
    assert client.post(url, json={"question": "x" * 501}, headers=auth(users["admin"])).status_code == 422


# --- E20: auth ---------------------------------------------------------------- #

def test_no_token_is_rejected(client, fake_ids):
    response = client.post(URL.format(fake_ids["Test Retail Pvt Ltd"]), json={"question": "Revenue?"})
    # HTTPBearer in this FastAPI version answers 401 (older versions answered 403)
    assert response.status_code in (401, 403)


def test_invalid_token_is_401(client, fake_ids):
    response = client.post(
        URL.format(fake_ids["Test Retail Pvt Ltd"]),
        json={"question": "Revenue?"},
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert response.status_code == 401
