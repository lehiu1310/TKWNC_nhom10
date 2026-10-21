from fastapi.testclient import TestClient
import pytest

from api import account_store, main


@pytest.fixture
def account_client(tmp_path, monkeypatch):
    monkeypatch.setattr(account_store, "DB_PATH", tmp_path / "accounts.sqlite3")
    with TestClient(main.app) as client:
        yield client


def test_register_login_sync_and_logout(account_client):
    client = account_client
    response = client.post("/api/auth/register", json={
        "email": "Flower@example.com", "display_name": "Mai", "password": "garden-pass-123",
    })
    assert response.status_code == 201
    assert response.json()["user"]["email"] == "flower@example.com"
    assert "httponly" in response.headers["set-cookie"].lower()
    assert client.get("/api/auth/me").json()["user"]["display_name"] == "Mai"

    payload = {"plants": [{"speciesId": "roses"}]}
    assert client.put("/api/account/data/garden", json={"payload": payload}).status_code == 200
    assert client.get("/api/account/data/garden").json()["payload"] == payload

    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/account/data/garden").status_code == 401
    login = client.post("/api/auth/login", json={"email": "FLOWER@example.com", "password": "garden-pass-123"})
    assert login.status_code == 200
    assert client.get("/api/account/data/garden").json()["payload"] == payload


def test_auth_validation_and_duplicate_email(account_client):
    client = account_client
    assert client.post("/api/auth/register", json={"email": "bad", "display_name": "A", "password": "short"}).status_code == 422
    assert client.post("/api/auth/register", json={"email": "a@example.com", "display_name": "  ", "password": "correct-horse-1"}).status_code == 422
    body = {"email": "a@example.com", "display_name": "A", "password": "correct-horse-1"}
    assert client.post("/api/auth/register", json=body).status_code == 201
    assert client.post("/api/auth/register", json=body).status_code == 409
    assert client.post("/api/auth/login", json={"email": body["email"], "password": "wrong-password"}).status_code == 401


def test_account_data_is_private_and_limited(account_client):
    client = account_client
    assert client.get("/api/account/data/garden").status_code == 401
    assert client.post("/api/auth/register", json={"email": "a@example.com", "display_name": "A", "password": "correct-horse-1"}).status_code == 201
    assert client.get("/api/account/data/unrecognized").status_code == 404
    assert client.put("/api/account/data/garden", json={"payload": {"blob": "x" * 257_000}}).status_code == 413


def test_rejects_cross_origin_auth_mutation(account_client):
    response = account_client.post("/api/auth/register", headers={"Origin": "https://bad.example"}, json={
        "email": "a@example.com", "display_name": "A", "password": "correct-horse-1",
    })
    assert response.status_code == 403
