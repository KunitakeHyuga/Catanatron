import type { GameState } from "./api.types";
import type { GameRecordSummary } from "./apiClient";

const STORAGE_KEY = "catanatron:records";
const MAX_RECORDS = 100;

export type LocalRecord = GameRecordSummary & { updated_at: number };

function safeParse(value: string | null): LocalRecord[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((entry) => typeof entry?.game_id === "string");
    }
    return [];
  } catch (error) {
    console.error("Failed to parse local records", error);
    return [];
  }
}

export function getLocalRecords(): LocalRecord[] {
  if (typeof window === "undefined") {
    return [];
  }
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function persist(records: LocalRecord[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function upsertLocalRecord(
  gameId: string,
  gameState: GameState
) {
  if (typeof window === "undefined") {
    return;
  }
  const current: LocalRecord[] = getLocalRecords();
  const withoutCurrent = current.filter((record) => record.game_id !== gameId);
  const nextRecord: LocalRecord = {
    game_id: gameId,
    updated_at: Date.now(),
    state_index: gameState.state_index,
    winning_color: gameState.winning_color ?? null,
    current_color: gameState.current_color,
    player_colors: gameState.colors,
  };
  const updated = [nextRecord, ...withoutCurrent]
    .sort((a, b) => b.updated_at - a.updated_at)
    .slice(0, MAX_RECORDS);
  persist(updated);
}
