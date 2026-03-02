import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


TEST_DB_PATH = Path(__file__).resolve().parent / "test_api.sqlite3"
os.environ["RASSVET_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def cleanup_test_db() -> None:
    uploads_dir = Path(__file__).resolve().parents[1] / "uploads" / "photos"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    for file_path in uploads_dir.glob("*"):
        if file_path.is_file():
            file_path.unlink()
    for suffix in ("", "-wal", "-shm"):
        target = Path(f"{TEST_DB_PATH}{suffix}")
        if target.exists():
            target.unlink()
    yield
    for file_path in uploads_dir.glob("*"):
        if file_path.is_file():
            file_path.unlink()
    for suffix in ("", "-wal", "-shm"):
        target = Path(f"{TEST_DB_PATH}{suffix}")
        if target.exists():
            target.unlink()


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


def test_navigation_by_roles(client: TestClient) -> None:
    admin_headers = auth_headers(client, "tymchenko_av", "admin123")
    volunteer_headers = auth_headers(client, "petrov_na", "volunteer123")

    admin_nav = client.get("/api/ui/navigation", headers=admin_headers)
    assert admin_nav.status_code == 200
    admin_tabs = admin_nav.json()["данные"]["вкладки"]
    assert len(admin_tabs) == 4
    assert {item["key"] for item in admin_tabs} == {"admin", "people", "game_profiles", "games"}

    volunteer_nav = client.get("/api/ui/navigation", headers=volunteer_headers)
    assert volunteer_nav.status_code == 200
    volunteer_tabs = volunteer_nav.json()["данные"]["вкладки"]
    assert {item["key"] for item in volunteer_tabs} == {"people", "game_profiles", "games"}


def test_blocked_account_and_role_cannot_login(client: TestClient) -> None:
    admin_headers = auth_headers(client, "tymchenko_av", "admin123")
    bootstrap = client.get("/api/admin/bootstrap", headers=admin_headers)
    assert bootstrap.status_code == 200
    data = bootstrap.json()["данные"]

    volunteer_account = next(item for item in data["аккаунты"] if item["логин"] == "petrov_na")
    volunteer_role = next(item for item in data["роли"] if item["код"] == "VOLUNTEER")

    block_account = client.patch(
        f"/api/admin/accounts/{volunteer_account['id']}",
        headers=admin_headers,
        json={"is_blocked": True},
    )
    assert block_account.status_code == 200

    login_blocked = client.post("/api/auth/login", json={"login": "petrov_na", "password": "volunteer123"})
    assert login_blocked.status_code == 403
    assert "заблокирован" in login_blocked.json()["detail"]

    unfreeze = client.patch(
        f"/api/admin/accounts/{volunteer_account['id']}",
        headers=admin_headers,
        json={"is_blocked": False},
    )
    assert unfreeze.status_code == 200

    block_role = client.patch(
        f"/api/admin/roles/{volunteer_role['id']}",
        headers=admin_headers,
        json={"is_blocked": True},
    )
    assert block_role.status_code == 200

    login_attempt = client.post("/api/auth/login", json={"login": "petrov_na", "password": "volunteer123"})
    assert login_attempt.status_code == 403
    assert "Роль пользователя заблокирована" in login_attempt.json()["detail"]


def test_password_reset_requires_change(client: TestClient) -> None:
    admin_headers = auth_headers(client, "tymchenko_av", "admin123")
    bootstrap = client.get("/api/admin/bootstrap", headers=admin_headers)
    assert bootstrap.status_code == 200
    data = bootstrap.json()["данные"]

    volunteer_account = next(item for item in data["аккаунты"] if item["логин"] == "petrov_na")
    reset = client.post(f"/api/admin/accounts/{volunteer_account['id']}/reset-password", headers=admin_headers)
    assert reset.status_code == 200

    login_after_reset = client.post(
        "/api/auth/login",
        json={"login": "petrov_na", "password": "pas123"},
    )
    assert login_after_reset.status_code == 200
    user_payload = login_after_reset.json()["данные"]["пользователь"]
    assert user_payload["нужна_смена_пароля"] is True

    token = login_after_reset.json()["данные"]["токен"]
    change_password = client.post(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={"current_password": "pas123", "new_password": "new-pass-001"},
    )
    assert change_password.status_code == 200

    final_login = client.post(
        "/api/auth/login",
        json={"login": "petrov_na", "password": "new-pass-001"},
    )
    assert final_login.status_code == 200
    assert final_login.json()["данные"]["пользователь"]["нужна_смена_пароля"] is False


def test_profile_access_for_volunteer_read_only(client: TestClient) -> None:
    headers = auth_headers(client, "petrov_na", "volunteer123")
    response = client.get("/api/profiles/participant/1", headers=headers)
    assert response.status_code == 200
    data = response.json()["данные"]
    assert data["доступ"]["изменение"] is False
    assert "игровой_профиль" not in data
    assert "родственники" in data


def test_admin_can_edit_login_and_fio_with_unique_login_constraint(client: TestClient) -> None:
    headers = auth_headers(client, "tymchenko_av", "admin123")
    bootstrap = client.get("/api/admin/bootstrap", headers=headers)
    assert bootstrap.status_code == 200
    accounts = bootstrap.json()["данные"]["аккаунты"]
    first = accounts[0]
    second = accounts[1]

    conflict = client.patch(
        f"/api/admin/accounts/{first['id']}",
        headers=headers,
        json={"login": second["логин"]},
    )
    assert conflict.status_code == 400
    assert "Логин уже используется" in conflict.json()["detail"]

    updated = client.patch(
        f"/api/admin/accounts/{first['id']}",
        headers=headers,
        json={
            "login": "admin_unique_test",
            "employee_full_name": "Тестов Тест Тестович",
        },
    )
    assert updated.status_code == 200

    refresh = client.get("/api/admin/bootstrap", headers=headers)
    assert refresh.status_code == 200
    refreshed_accounts = refresh.json()["данные"]["аккаунты"]
    refreshed = next(row for row in refreshed_accounts if row["id"] == first["id"])
    assert refreshed["логин"] == "admin_unique_test"
    assert refreshed["сотрудник_фио"] == "Тестов Тест Тестович"


def test_admin_can_upload_account_photo(client: TestClient) -> None:
    headers = auth_headers(client, "tymchenko_av", "admin123")
    bootstrap = client.get("/api/admin/bootstrap", headers=headers)
    assert bootstrap.status_code == 200
    accounts = bootstrap.json()["данные"]["аккаунты"]
    target = accounts[1]

    photo_upload = client.post(
        f"/api/admin/accounts/{target['id']}/photo",
        headers=headers,
        files={"photo": ("test_avatar.png", b"fake-image-content", "image/png")},
    )
    assert photo_upload.status_code == 200
    photo_url = photo_upload.json()["данные"]["photo_url"]
    assert photo_url.startswith("/uploads/photos/")

    refresh = client.get("/api/admin/bootstrap", headers=headers)
    assert refresh.status_code == 200
    refreshed_accounts = refresh.json()["данные"]["аккаунты"]
    refreshed = next(row for row in refreshed_accounts if row["id"] == target["id"])
    assert refreshed["фото"] == photo_url

