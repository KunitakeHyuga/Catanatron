import pytest
import json
from unittest.mock import patch
from catanatron.web import create_app
from catanatron.web.models import db, GameState, get_game_state, upsert_game_state
from catanatron.models.enums import ActionPrompt
from catanatron.models.actions import generate_playable_actions


@pytest.fixture
def app():
    """Create and configure a new app instance for each test."""
    # Setup an in-memory SQLite database for testing
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

    # Teardown: drop all tables after each test (optional, if tests are isolated)
    # with app.app_context():
    #     db.drop_all()


@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()


def test_post_game_endpoint(client):
    """Test creating a new game."""
    response = client.post("/api/games", json={"players": ["RANDOM", "RANDOM"]})
    assert response.status_code == 200
    data = json.loads(response.data)
    assert "game_id" in data
    # Further check: Ensure the game was actually created in the db
    with client.application.app_context():
        assert (
            db.session.query(GameState).filter_by(uuid=data["game_id"]).first()
            is not None
        )


def test_get_game_endpoint(client):
    """Test retrieving a specific game state."""
    # First, create a game to retrieve
    post_response = client.post("/api/games", json={"players": ["RANDOM", "RANDOM"]})
    game_id = json.loads(post_response.data)["game_id"]

    # Retrieve the initial state (state_index 0)
    response = client.get(f"/api/games/{game_id}/states/0")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert "nodes" in data
    assert "edges" in data
    assert data["is_initial_build_phase"] is True
    assert data["winning_color"] is None


def test_get_latest_game_endpoint(client):
    """Test retrieving the latest game state."""
    post_response = client.post("/api/games", json={"players": ["RANDOM", "RANDOM"]})
    game_id = json.loads(post_response.data)["game_id"]

    response = client.get(f"/api/games/{game_id}/states/latest")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert "nodes" in data
    assert "edges" in data
    assert data["is_initial_build_phase"] is True
    assert data["winning_color"] is None


def test_get_game_not_found(client):
    """Test retrieving a non-existent game."""
    response = client.get("/api/games/nonexistentgameid/states/0")
    assert response.status_code == 404


def test_post_action_bot_turn(client):
    """Test posting an action when it's a bot's turn."""
    # Create a game with at least one bot (RANDOM is a bot)
    post_response = client.post("/api/games", json={"players": ["RANDOM", "HUMAN"]})
    assert post_response.status_code == 200
    game_id = json.loads(post_response.data)["game_id"]

    data_before_res = client.get(f"/api/games/{game_id}/states/latest")
    data_before = json.loads(data_before_res.data)

    after_action_res = client.post(f"/api/games/{game_id}/actions", json={})
    assert after_action_res.status_code == 200
    data_after = json.loads(after_action_res.data)

    # Check if game state progressed, e.g., turn changed or actions list grew
    assert len(data_after["action_records"]) > len(data_before["action_records"])


def test_post_action_requires_payload_on_human_turn(client):
    """Ensure empty POSTs are rejected when a human must act."""
    post_response = client.post(
        "/api/games", json={"players": ["HUMAN", "RANDOM", "RANDOM"]}
    )
    assert post_response.status_code == 200
    game_id = json.loads(post_response.data)["game_id"]

    # Advance bots until it's a human's turn
    while True:
        latest = client.get(f"/api/games/{game_id}/states/latest")
        assert latest.status_code == 200
        latest_data = json.loads(latest.data)
        current_color = latest_data["current_color"]
        bot_colors = set(latest_data["bot_colors"])
        if current_color not in bot_colors:
            break
        advance = client.post(f"/api/games/{game_id}/actions", json={})
        assert advance.status_code == 200

    actions_before = len(latest_data["action_records"])
    response = client.post(f"/api/games/{game_id}/actions")
    assert response.status_code == 400

    after = client.get(f"/api/games/{game_id}/states/latest")
    assert after.status_code == 200
    after_data = json.loads(after.data)
    assert len(after_data["action_records"]) == actions_before


def test_human_can_cancel_trade_during_bot_responses(client):
    """Allow a human offerer to cancel even when bots are currently responding."""
    post_response = client.post(
        "/api/games", json={"players": ["HUMAN", "RANDOM", "RANDOM"]}
    )
    assert post_response.status_code == 200
    game_id = json.loads(post_response.data)["game_id"]

    with client.application.app_context():
        game = get_game_state(game_id)
        state = game.state
        state.is_initial_build_phase = False
        state.current_turn_index = 0  # human offerer
        state.current_player_index = 1  # waiting for first bot to respond
        state.current_prompt = ActionPrompt.DECIDE_TRADE
        state.is_resolving_trade = True
        trade_vector = (1, 0, 0, 0, 0, 0, 1, 0, 0, 0)
        state.current_trade = (*trade_vector, state.current_turn_index)
        state.acceptees = tuple(False for _ in state.colors)
        state.trade_responses = tuple(False for _ in state.colors)
        game.playable_actions = generate_playable_actions(state)
        upsert_game_state(game)

    before_resp = client.get(f"/api/games/{game_id}/states/latest")
    assert before_resp.status_code == 200
    before = json.loads(before_resp.data)
    assert before["current_color"] == "BLUE"  # bot turn
    assert before["current_prompt"] == ActionPrompt.DECIDE_TRADE.value
    assert before["trade"] is not None
    before_actions = len(before["action_records"])

    cancel_payload = ["RED", "CANCEL_TRADE", None]
    cancel_resp = client.post(
        f"/api/games/{game_id}/actions",
        json=cancel_payload,
    )
    assert cancel_resp.status_code == 200
    after = json.loads(cancel_resp.data)
    assert after["current_color"] == "RED"
    assert after["current_prompt"] == "PLAY_TURN"
    assert after["trade"] is None
    assert len(after["action_records"]) == before_actions + 1


def test_mcts_analysis_endpoint(client):
    """Test the MCTS analysis endpoint."""
    post_response = client.post("/api/games", json={"players": ["RANDOM", "RANDOM"]})
    game_id = json.loads(post_response.data)["game_id"]

    # Request MCTS analysis for the latest state
    response = client.get(f"/api/games/{game_id}/states/latest/mcts-analysis")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["success"] is True
    assert "probabilities" in data
    # Further checks on probabilities structure if known
    assert len(data["probabilities"]) == 2  # For two players


def test_mcts_analysis_game_not_found(client):
    """Test MCTS analysis for a non-existent game."""
    response = client.get("/api/games/nonexistent/states/nonexistent/mcts-analysis")
    assert response.status_code == 400


# Stress test endpoint is simple, just check if it runs
def test_stress_test_endpoint(client):
    response = client.get("/api/stress-test")
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["winning_color"] is None


def test_negotiation_advice_logs_event_and_listed(client):
    """Ensure requesting advice logs an event and it can be fetched."""
    post_response = client.post(
        "/api/games", json={"players": ["HUMAN", "RANDOM", "RANDOM", "RANDOM"]}
    )
    assert post_response.status_code == 200
    game_id = json.loads(post_response.data)["game_id"]

    with patch("catanatron.web.api.request_negotiation_advice") as mock_advice:
        mock_advice.return_value = {"advice": "dummy"}
        response = client.post(
            f"/api/games/{game_id}/states/latest/negotiation-advice"
        )
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data["success"] is True
    assert data["advice"] == "dummy"

    events_resp = client.get(f"/api/games/{game_id}/events")
    assert events_resp.status_code == 200
    events_data = json.loads(events_resp.data)
    events = events_data.get("events", [])
    assert len(events) == 1
    event = events[0]
    assert event["event_type"] == "NEGOTIATION_ADVICE_REQUEST"
    assert event["state_index"] == 0
    assert event["payload"]["requester_color"] == "RED"
