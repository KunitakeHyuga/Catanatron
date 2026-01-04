from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Tuple

try:
    from openai import OpenAI, OpenAIError
except ImportError as exc:  # pragma: no cover - happens when optional dep missing
    OpenAI = None  # type: ignore[assignment]
    OpenAIError = Exception  # type: ignore[assignment]
    _OPENAI_IMPORT_ERROR = exc
else:
    _OPENAI_IMPORT_ERROR = None

from catanatron.game import Game
from catanatron.json import GameEncoder
from catanatron.models.enums import DEVELOPMENT_CARDS, RESOURCES


class NegotiationAdviceError(Exception):
    """Base error for negotiation advice endpoint."""


class NegotiationAdviceUnavailableError(NegotiationAdviceError):
    """Raised when the OpenAI client cannot be initialized."""


_openai_client: OpenAI | None = None


def _get_openai_client() -> OpenAI:
    global _openai_client
    if OpenAI is None:
        raise NegotiationAdviceUnavailableError(
            "openai package is not installed. "
            "Install catanatron with the 'web' extra or `pip install openai>=1.6.0`."
        ) from _OPENAI_IMPORT_ERROR

    if _openai_client is not None:
        return _openai_client

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise NegotiationAdviceUnavailableError(
            "OPENAI_API_KEY is not configured on the server."
        )

    _openai_client = OpenAI(api_key=api_key)
    return _openai_client


def _to_pretty_json(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2)


def _summarize_player_state(game_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    player_state = game_payload.get("player_state", {})
    summaries: List[Dict[str, Any]] = []
    for index, color in enumerate(game_payload.get("colors", [])):
        prefix = f"P{index}_"
        resources = {
            resource: player_state.get(f"{prefix}{resource}_IN_HAND", 0)
            for resource in RESOURCES
        }
        dev_cards = {
            card: player_state.get(f"{prefix}{card}_IN_HAND", 0)
            for card in DEVELOPMENT_CARDS
        }
        summaries.append(
            {
                "color": color,
                "victory_points": player_state.get(f"{prefix}VICTORY_POINTS"),
                "actual_victory_points": player_state.get(
                    f"{prefix}ACTUAL_VICTORY_POINTS"
                ),
                "resources_in_hand": resources,
                "development_cards_in_hand": dev_cards,
                "has_longest_road": player_state.get(f"{prefix}HAS_ROAD"),
                "has_largest_army": player_state.get(f"{prefix}HAS_ARMY"),
                "knights_played": player_state.get(f"{prefix}PLAYED_KNIGHT"),
                "monopoly_played": player_state.get(f"{prefix}PLAYED_MONOPOLY"),
                "year_of_plenty_played": player_state.get(
                    f"{prefix}PLAYED_YEAR_OF_PLENTY"
                ),
                "road_building_played": player_state.get(
                    f"{prefix}PLAYED_ROAD_BUILDING"
                ),
            }
        )
    return summaries


def _summarize_board(game_payload: Dict[str, Any]) -> Dict[str, Any]:
    nodes = game_payload.get("nodes", {})
    if isinstance(nodes, dict):
        node_values = list(nodes.values())
    else:
        node_values = nodes
    built_structures = [
        {
            "node_id": node.get("id"),
            "color": node.get("color"),
            "building": node.get("building"),
            "tile_coordinate": node.get("tile_coordinate"),
        }
        for node in node_values
        if node.get("color")
    ]
    claimed_roads = [
        {"edge_id": edge.get("id"), "color": edge.get("color")}
        for edge in game_payload.get("edges", [])
        if edge.get("color")
    ]
    return {
        "tiles": game_payload.get("tiles"),
        "robber_coordinate": game_payload.get("robber_coordinate"),
        "built_structures": built_structures,
        "claimed_roads": claimed_roads,
    }


def _summarize_actions(
    action_records: List[list], max_items: int
) -> Tuple[List[Dict[str, Any]], int]:
    trimmed = action_records[-max_items:] if max_items else action_records
    starting_index = len(action_records) - len(trimmed)
    formatted: List[Dict[str, Any]] = []
    for idx, record in enumerate(trimmed):
        if not isinstance(record, list) or len(record) != 2:
            continue
        action, result = record
        formatted.append(
            {
                "sequence": starting_index + idx + 1,
                "color": action[0] if action else None,
                "action": action[1] if action else None,
                "value": action[2] if action else None,
                "result": result,
            }
        )
    return formatted, starting_index


def _build_prompt(game: Game) -> Tuple[str, Dict[str, Any]]:
    payload = json.loads(json.dumps(game, cls=GameEncoder))
    player_summaries = _summarize_player_state(payload)
    board_snapshot = _summarize_board(payload)
    max_actions = int(os.environ.get("NEGOTIATION_LOG_LIMIT", "32"))
    formatted_actions, action_offset = _summarize_actions(
        payload.get("action_records", []),
        max_actions,
    )

    playable_actions = payload.get("current_playable_actions", [])
    human_colors = sorted(
        list(set(payload.get("colors", [])) - set(payload.get("bot_colors", [])))
    )
    context = {
        "player_summaries": player_summaries,
        "board_snapshot": board_snapshot,
        "recent_action_log": formatted_actions,
        "action_offset": action_offset,
        "current_color": payload.get("current_color"),
        "human_colors": human_colors,
        "playable_actions": playable_actions,
        "longest_roads_by_player": payload.get("longest_roads_by_player"),
    }

    prompt = "\n".join(
        [
            "## ゲーム状況",
            f"現在の手番: {payload.get('current_color')}",
            f"人間プレイヤー: {', '.join(human_colors) if human_colors else '（全員ボット）'}",
            "### プレイヤー情報",
            _to_pretty_json(player_summaries),
            "### 盤面サマリ",
            _to_pretty_json(board_snapshot),
            "### 最近の行動ログ",
            _to_pretty_json(formatted_actions),
            "### 現在可能なアクション",
            _to_pretty_json(playable_actions),
        ]
    )

    return prompt, context


def generate_negotiation_advice(game: Game) -> Tuple[str, Dict[str, Any]]:
    client = _get_openai_client()
    prompt, context = _build_prompt(game)
    model = os.environ.get("NEGOTIATION_ADVICE_MODEL") or os.environ.get(
        "OPENAI_MODEL", "gpt-4o-mini"
    )
    temperature = float(os.environ.get("NEGOTIATION_ADVICE_TEMPERATURE", "0.4"))

    try:
        response = client.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert Settlers of Catan negotiation coach. "
                    "Provide concise trade/negotiation ideas in Japanese.",
                },
                {
                    "role": "user",
                    "content": prompt
                    + (
                        "\n\nこの交渉支援AIエージェントは、初心者プレイヤーの交渉時に発生する判断負荷を"
                        " (1)状況把握負荷(情報処理)、(2)戦略判断負荷(意思決定)、(3)対人交渉負荷(コミュニケーション)"
                        " の3軸で測定します。アンケート項目(1)〜(15)に対応する10段階評価"
                        "（1=全く負担を感じない、10=非常に大きな負担）の推定値を提示してください。"
                        " 項目(3)(4)(10)は逆転項目であり、負担が小さいほど評価が低くなる点に留意してください。\n"
                        "以下のフォーマットで日本語のテキストを生成してください:\n"
                        "## 判断負荷推定\n"
                        "- 状況把握負荷(情報処理): 数値/10 … (該当項目番号を括弧書きで示し、盤面やログのどの情報が負担や軽減要因か1文で説明)\n"
                        "- 戦略判断負荷(意思決定): 数値/10 … (同上)\n"
                        "- 対人交渉負荷(コミュニケーション): 数値/10 … (同上)\n"
                        "## 交渉アドバイス\n"
                        "1. …（狙い: … / 想定される相手の反応: …）\n"
                        "2. …（狙い: … / 想定される相手の反応: …）\n"
                        "3. …（狙い: … / 想定される相手の反応: …）\n"
                        "交渉アドバイスは人間プレイヤーが交渉で有利になるための具体策を最大3つ、番号付きで述べ、各アドバイスに狙いと想定される相手の反応を含めてください。"
                    ),
                },
            ],
        )
    except OpenAIError as exc:
        raise NegotiationAdviceError(str(exc)) from exc

    choices = getattr(response, "choices", [])
    if not choices:
        raise NegotiationAdviceError("OpenAI API response did not include any choices.")

    advice = choices[0].message.content if choices[0].message else None
    if not advice:
        raise NegotiationAdviceError("OpenAI API response did not include text content.")

    return advice.strip(), context


def request_negotiation_advice(game: Game) -> Dict[str, Any]:
    """
    Public helper that hides the raw OpenAI payload and only returns fields that the API
    endpoint should expose.
    """
    advice, _ = generate_negotiation_advice(game)
    return {"advice": advice}
