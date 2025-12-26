import axios from "axios";

import { API_URL } from "../configuration";
import type { Color, GameAction, GameState } from "./api.types";

type Player = "HUMAN" | "RANDOM" | "CATANATRON";
export type StateIndex = number | `${number}` | "latest";

export async function createGame(players: Player[]) {
  const response = await axios.post(API_URL + "/api/games", { players });
  return response.data.game_id;
}

export async function getState(
  gameId: string,
  stateIndex: StateIndex = "latest"
): Promise<GameState> {
  const response = await axios.get(
    `${API_URL}/api/games/${gameId}/states/${stateIndex}`
  );
  return response.data;
}

/** action=undefined means bot action */
export async function postAction(gameId: string, action?: GameAction) {
  const response = await axios.post<GameState>(
    `${API_URL}/api/games/${gameId}/actions`,
    action
  );
  return response.data;
}

export type GameRecordSummary = {
  game_id: string;
  state_index: number;
  winning_color: Color | null;
  current_color: Color;
  player_colors: Color[];
};

export async function listGames(): Promise<GameRecordSummary[]> {
  const response = await axios.get<{ games: GameRecordSummary[] }>(
    `${API_URL}/api/games`
  );
  return response.data.games;
}

export type MCTSProbabilities = {
  [K in Color]: number;
};

export type NegotiationAdviceResult = {
  success: boolean;
  advice?: string;
  error?: string;
};

type MCTSSuccessBody = {
  success: true;
  probabilities: MCTSProbabilities;
  state_index: number;
};
type MCTSErrorBody = {
  success: false;
  error: string;
  trace: string;
};

export async function getMctsAnalysis(
  gameId: string,
  stateIndex: StateIndex = "latest"
) {
  try {
    console.log("MCTS解析の取得中:", {
      gameId,
      stateIndex,
      url: `${API_URL}/api/games/${gameId}/states/${stateIndex}/mcts-analysis`,
    });

    if (!gameId) {
      throw new Error("getMctsAnalysis に gameId が指定されていません");
    }

    const response = await axios.get<MCTSSuccessBody | MCTSErrorBody>(
      `${API_URL}/api/games/${gameId}/states/${stateIndex}/mcts-analysis`
    );

    console.log("MCTS解析のレスポンス:", response.data);
    return response.data;
  } catch (error: any) {
    // AxiosResponse<MCTSErrorBody>
    console.error("MCTS解析でエラー:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      stack: error.stack,
    });
    throw error;
  }
}

export async function requestNegotiationAdvice(
  gameId: string,
  stateIndex: StateIndex = "latest"
): Promise<NegotiationAdviceResult> {
  try {
    const response = await axios.post<NegotiationAdviceResult>(
      `${API_URL}/api/games/${gameId}/states/${stateIndex}/negotiation-advice`
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return error.response.data as NegotiationAdviceResult;
    }
    throw error;
  }
}
