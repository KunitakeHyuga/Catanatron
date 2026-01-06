from __future__ import annotations

import json
import logging
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


def generate_negotiation_advice(
    game: Game, board_image_data_url: str | None = None
) -> Tuple[str, Dict[str, Any]]:
    client = _get_openai_client()
    prompt, context = _build_prompt(game)
    fallback_model = os.environ.get("NEGOTIATION_ADVICE_FALLBACK_MODEL", "gpt-4o-mini")
    preferred_model = os.environ.get("NEGOTIATION_ADVICE_MODEL") or os.environ.get(
        "OPENAI_MODEL"
    )
    model = preferred_model or fallback_model
    temperature_value = os.environ.get("NEGOTIATION_ADVICE_TEMPERATURE", "").strip()
    temperature: float | None
    if temperature_value:
        try:
            temperature = float(temperature_value)
        except ValueError:
            temperature = None
    else:
        temperature = None
    instructions = "\n".join(
        [
            "あなたはカタンの交渉支援AIエージェントです。初心者プレイヤーの交渉の手助けをしてください。以下のテンプレートを厳守し、日本語で回答してください。",
            "プレイヤー色は必ず「赤」「青」「白」「オレンジ」の表記を使い、資源名は「木材」「レンガ」「羊毛」「小麦」「鉱石」で統一してください。",
            "テンプレート以外の文章は追加しないこと。",
            "今は(交渉する/交渉しない)。",
            "理由：(1行で簡潔に)。",
            "",
            "今見るもの（最大5）",
            " 自分の不足資源：",
            " 相手AのVPと最長路/最大騎士：",
            " ロバー位置と直近の出目：",
            " 港の有無：",
            " 相手の手札枚数：",
            "",
            "おすすめ交渉（上位2）",
            "1) 相手：(Px)",
            "    受：(資源)",
            "    譲：(資源)",
            "    自分の得：(1行)",
            "    相手の得：(1行)",
            "    注意：(1行)",
            "    成功率見込み：(0.xx)",
            "",
            "   許容範囲",
            "    上限：(出してよい最大)",
            "    NG：(絶対出さないもの)",
            "",
            "2) 相手：(Py)",
            "    受：(資源)",
            "    譲：(資源)",
            "    自分の得：(1行)",
            "    相手の得：(1行)",
            "    注意：(1行)",
            "    成功率見込み：(0.xx)",
            "",
            "   許容範囲",
            "    上限：(出してよい最大)",
            "    NG：(絶対出さないもの)",
            "",
        ]
    )
    prompt_with_instructions = f"{prompt}\n\n{instructions}"
    human_colors = context.get("human_colors") or []
    playable_actions = context.get("playable_actions") or []
    logging.info(
        "Negotiation prompt ready: model=%s temp=%s board_image=%s prompt_chars=%d humans=%s playable_actions=%d",
        model,
        temperature if temperature is not None else "default",
        bool(board_image_data_url),
        len(prompt_with_instructions),
        ",".join(human_colors) if human_colors else "(none)",
        len(playable_actions),
    )
    if board_image_data_url:
        prompt_with_instructions += (
            "\n\n盤面JPEGも参照できます。テンプレ内で必要な箇所に画像の情報を1行程度で織り込み、画像を確認したと分かる短い一言を添えてください。"
            " 画像専用の詳細セクションを追加する必要はありません。"
        )
    if board_image_data_url:
        user_content: Any = [
            {"type": "text", "text": prompt_with_instructions},
            {
                "type": "image_url",
                "image_url": {"url": board_image_data_url, "detail": "low"},
            },
        ]
    else:
        user_content = prompt_with_instructions

    try:
        request_kwargs: Dict[str, Any] = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert Settlers of Catan negotiation coach. "
                    "Provide concise trade/negotiation ideas in Japanese.",
                },
                {
                    "role": "user",
                    "content": user_content,
                },
            ],
        }
        if temperature is not None:
            request_kwargs["temperature"] = temperature
        logging.info(
            "Negotiation advice request -> model=%s temp=%s board_image=%s",
            request_kwargs.get("model"),
            request_kwargs.get("temperature", "default"),
            bool(board_image_data_url),
        )
        def _execute_request() -> Any:
            return client.chat.completions.create(**request_kwargs)

        try:
            response = _execute_request()
        except OpenAIError as exc:
            error_code = getattr(exc, "code", None)
            if temperature is not None and error_code == "unsupported_value":
                logging.warning(
                    "Negotiation advice temperature unsupported (temp=%s). Retrying without it.",
                    temperature,
                )
                request_kwargs.pop("temperature", None)
                response = _execute_request()
            elif error_code == "model_not_found" and request_kwargs.get(
                "model"
            ) != fallback_model:
                logging.warning(
                    "Negotiation advice model '%s' not found. Falling back to '%s'.",
                    request_kwargs.get("model"),
                    fallback_model,
                )
                request_kwargs["model"] = fallback_model
                response = _execute_request()
            else:
                raise
    except OpenAIError as exc:
        logging.exception("Negotiation advice OpenAI error: %s", exc)
        raise NegotiationAdviceError(str(exc)) from exc

    choices = getattr(response, "choices", [])
    usage = getattr(response, "usage", None)
    finish_reason = choices[0].finish_reason if choices else None
    logging.info(
        "Negotiation advice response <- choices=%d finish=%s usage=%s",
        len(choices),
        finish_reason,
        usage,
    )
    if not choices:
        raise NegotiationAdviceError("OpenAI API response did not include any choices.")

    advice = choices[0].message.content if choices[0].message else None
    if not advice:
        raise NegotiationAdviceError("OpenAI API response did not include text content.")

    return advice.strip(), context


def request_negotiation_advice(
    game: Game, board_image_data_url: str | None = None
) -> Dict[str, Any]:
    """
    Public helper that hides the raw OpenAI payload and only returns fields that the API
    endpoint should expose.
    """
    advice, _ = generate_negotiation_advice(game, board_image_data_url)
    return {"advice": advice}
