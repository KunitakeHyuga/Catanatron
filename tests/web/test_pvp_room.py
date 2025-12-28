import json
import pytest

from catanatron.web import create_app
from catanatron.web.models import db


@pytest.fixture
def app():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test",
        }
    )
    with app.app_context():
        db.create_all()
    yield app


@pytest.fixture
def client(app):
    return app.test_client()


def _create_room(client, name="Room"):
    response = client.post("/api/pvp/rooms", json={"room_name": name})
    assert response.status_code == 201
    return response.get_json()


def _join(client, room_id, name):
    response = client.post(
        f"/api/pvp/rooms/{room_id}/join", json={"user_name": name}
    )
    assert response.status_code == 200
    return response.get_json()


def test_join_room_assigns_unique_seats(client):
    room = _create_room(client)
    data = _join(client, room["room_id"], "alice")
    assert data["seat_color"] == "RED"
    assert data["room"]["seats"][0]["user_name"] == "alice"


def test_join_room_limited_to_four_players(client):
    room = _create_room(client)
    _join(client, room["room_id"], "alice")
    _join(client, room["room_id"], "bob")
    _join(client, room["room_id"], "carol")
    _join(client, room["room_id"], "dave")
    response = client.post(
        f"/api/pvp/rooms/{room['room_id']}/join", json={"user_name": "erin"}
    )
    assert response.status_code == 409


def test_start_requires_host(client):
    room = _create_room(client)
    host = _join(client, room["room_id"], "alice")  # RED seat
    other = _join(client, room["room_id"], "bob")

    response = client.post(
        f"/api/pvp/rooms/{room['room_id']}/start",
        headers={"X-PVP-Token": other["token"]},
    )
    assert response.status_code == 403

    response = client.post(
        f"/api/pvp/rooms/{room['room_id']}/start",
        headers={"X-PVP-Token": host["token"]},
    )
    assert response.status_code == 200
    assert "game_id" in response.get_json()


def test_start_requires_two_players(client):
    room = _create_room(client)
    host = _join(client, room["room_id"], "alice")

    response = client.post(
        f"/api/pvp/rooms/{room['room_id']}/start",
        headers={"X-PVP-Token": host["token"]},
    )
    assert response.status_code == 400


def test_turn_enforcement_and_action(client):
    room = _create_room(client)
    tokens = [
        _join(client, room["room_id"], name)["token"]
        for name in ["alice", "bob", "carol", "dave"]
    ]
    host_token = tokens[0]

    start_res = client.post(
        f"/api/pvp/rooms/{room['room_id']}/start",
        headers={"X-PVP-Token": host_token},
    )
    assert start_res.status_code == 200

    game_res = client.get(
        f"/api/pvp/rooms/{room['room_id']}/game",
        headers={"X-PVP-Token": host_token},
    )
    assert game_res.status_code == 200
    game_data = json.loads(game_res.data)
    first_action = game_data["current_playable_actions"][0]

    action_res = client.post(
        f"/api/pvp/rooms/{room['room_id']}/action",
        json={"action": first_action, "expected_state_index": game_data["state_index"]},
        headers={"X-PVP-Token": host_token},
    )
    assert action_res.status_code == 200

    # Next player should now be BLUE (second token). Attempting with host should fail.
    conflict_res = client.post(
        f"/api/pvp/rooms/{room['room_id']}/action",
        json={"action": first_action},
        headers={"X-PVP-Token": host_token},
    )
    assert conflict_res.status_code == 403
