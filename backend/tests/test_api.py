import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


TEST_DB_PATH = Path(__file__).resolve().parent / "test_api.sqlite3"
os.environ["RASSVET_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from app.main import app  # noqa: E402


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as testing_client:
        yield testing_client


def auth_headers(client: TestClient, login: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"login": login, "password": password},
    )
    assert response.status_code == 200
    token = response.json()["данные"]["токен"]
    return {"Authorization": f"Bearer {token}"}


def test_health_endpoint_ru_response() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        payload = response.json()
        assert "сообщение" in payload
        assert payload["данные"]["режим_wal"] == "wal"


def test_admin_profile_access_and_game_summary(client: TestClient) -> None:
    headers = auth_headers(client, "tymchenko_av", "admin123")

    profiles_response = client.get("/api/profiles", headers=headers)
    assert profiles_response.status_code == 200
    participants = profiles_response.json()["данные"]["участники"]
    assert participants

    participant_id = participants[0]["id"]
    card_response = client.get(f"/api/profiles/participant/{participant_id}", headers=headers)
    assert card_response.status_code == 200
    card = card_response.json()["данные"]
    assert card["доступ"]["изменение"] is True
    assert "игровая_история" in card
    assert "родственники" in card


def test_volunteer_read_only_profile(client: TestClient) -> None:
    headers = auth_headers(client, "petrov_na", "volunteer123")
    response = client.get("/api/profiles/participant/1", headers=headers)
    assert response.status_code == 200
    data = response.json()["данные"]
    assert data["доступ"]["изменение"] is False
    assert "игровой_профиль" not in data
    assert "родственники" in data

