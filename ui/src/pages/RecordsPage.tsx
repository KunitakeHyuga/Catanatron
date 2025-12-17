import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { GridLoader } from "react-spinners";

import "./RecordsPage.scss";
import BoardSnapshot from "../components/BoardSnapshot";
import PlayerStateBox from "../components/PlayerStateBox";
import type { GameState } from "../utils/api.types";
import { getState, listGames, type GameRecordSummary } from "../utils/apiClient";
import { playerKey } from "../utils/stateUtils";
import { humanizeActionRecord } from "../utils/promptUtils";
import { colorLabel } from "../utils/i18n";
import {
  getLocalRecords,
  type LocalRecord,
} from "../utils/localRecords";

type EnrichedRecord = GameRecordSummary & { updated_at: number };

function enrichRemote(records: GameRecordSummary[]): EnrichedRecord[] {
  const baseTime = Date.now();
  return records.map((record, index) => ({
    ...record,
    updated_at: baseTime - index,
  }));
}

function mergeRecords(
  remote: GameRecordSummary[],
  local: LocalRecord[]
): GameRecordSummary[] {
  const mergedMap = new Map<string, EnrichedRecord>();
  enrichRemote(remote).forEach((record) => {
    mergedMap.set(record.game_id, record);
  });
  local.forEach((record) => {
    const existing = mergedMap.get(record.game_id);
    if (!existing || record.state_index >= existing.state_index) {
      mergedMap.set(record.game_id, record);
    }
  });
  return Array.from(mergedMap.values())
    .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
    .map(({ updated_at, ...rest }) => rest);
}

export default function RecordsPage() {
  const { gameId: paramsGameId } = useParams();
  const navigate = useNavigate();

  const [games, setGames] = useState<GameRecordSummary[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(
    paramsGameId ?? null
  );
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localAvailable, setLocalAvailable] = useState<boolean>(false);

  const loadGames = useCallback(async () => {
    const localRecords = getLocalRecords();
    setLocalAvailable(localRecords.length > 0);
    let remoteRecords: GameRecordSummary[] = [];
    try {
      setListLoading(true);
      setError(null);
      remoteRecords = await listGames();
    } catch (err) {
      console.error(err);
      setError("対戦記録の一覧を取得できませんでした。");
    } finally {
      setListLoading(false);
    }
    const combined = mergeRecords(remoteRecords, localRecords);
    setGames(combined);
    if (!paramsGameId && combined.length > 0 && !selectedGameId) {
      const [first] = combined;
      setSelectedGameId(first.game_id);
      navigate(`/records/${first.game_id}`, { replace: true });
    }
  }, [navigate, paramsGameId, selectedGameId]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  useEffect(() => {
    if (paramsGameId) {
      setSelectedGameId(paramsGameId);
    }
  }, [paramsGameId]);

  useEffect(() => {
    const fetchRecord = async () => {
      if (!selectedGameId) {
        setGameState(null);
        return;
      }
      try {
        setDetailLoading(true);
        setError(null);
        const latestState = await getState(selectedGameId, "latest");
        setGameState(latestState);
      } catch (err) {
        console.error(err);
        setError("対戦記録の詳細を取得できませんでした。");
        setGameState(null);
      } finally {
        setDetailLoading(false);
      }
    };
    fetchRecord();
  }, [selectedGameId]);

  const handleSelectGame = (gameId: string) => {
    setSelectedGameId(gameId);
    navigate(`/records/${gameId}`);
  };

  const selectedSummary = useMemo(
    () => games.find((game) => game.game_id === selectedGameId),
    [games, selectedGameId]
  );

  const winningLabel = useMemo(() => {
    if (!selectedSummary) {
      return "ゲームを選択してください";
    }
    if (!selectedSummary.winning_color) {
      return "進行中";
    }
    return `${colorLabel(selectedSummary.winning_color)} が勝利`;
  }, [selectedSummary]);

  return (
    <main className="records-page">
      <h1 className="logo">対戦記録</h1>
      {error && <div className="records-error">{error}</div>}
      <div className="records-layout">
        <aside className="records-list">
          <div className="records-list-header">対戦一覧</div>
          {listLoading && (
            <GridLoader
              className="loader"
              color="#ffffff"
              size={40}
            />
          )}
          {!listLoading && games.length === 0 && (
            <div className="records-empty">まだ対戦記録がありません。</div>
          )}
          {!listLoading && games.length > 0 && (
            <div className="records-items">
              {games.map((game) => (
                <button
                  key={game.game_id}
                  className={`record-item ${
                    selectedGameId === game.game_id ? "selected" : ""
                  }`}
                  onClick={() => handleSelectGame(game.game_id)}
                >
                  <div className="game-id">{game.game_id}</div>
                  <div className="game-meta">
                    <span>
                      勝者:{" "}
                      {game.winning_color
                        ? colorLabel(game.winning_color)
                        : "進行中"}
                    </span>
                    <span>ターン {game.state_index}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>
        <section className="records-detail">
          {detailLoading && (
            <GridLoader
              className="loader"
              color="#ffffff"
              size={60}
            />
          )}
          {!detailLoading && gameState && (
            <>
              <section className="records-summary">
                <div>
                  <span className="summary-label">ゲームID:</span>
                  <span className="summary-value">{selectedGameId}</span>
                </div>
                <div>
                  <span className="summary-label">勝者:</span>
                  <span className="summary-value">{winningLabel}</span>
                </div>
                <div>
                  <span className="summary-label">ターン数:</span>
                  <span className="summary-value">{gameState.state_index}</span>
                </div>
              </section>
              <section className="records-board">
                <h2>最終盤面</h2>
                <BoardSnapshot gameState={gameState} />
              </section>
              <section className="records-players">
                <h2>所持・利用カード</h2>
                <div className="players-grid">
                  {gameState.colors.map((color) => (
                    <PlayerStateBox
                      key={color}
                      color={color}
                      playerState={gameState.player_state}
                      playerKey={playerKey(gameState, color)}
                    />
                  ))}
                </div>
              </section>
              <section className="records-log">
                <h2>行動ログ</h2>
                <div className="log-entries">
                  {gameState.action_records
                    .slice()
                    .reverse()
                    .map((record, index) => (
                      <div
                        key={`${record[0][0]}-${index}`}
                        className={`log-entry ${record[0][0]} foreground`}
                      >
                        {humanizeActionRecord(gameState, record)}
                      </div>
                    ))}
                </div>
              </section>
            </>
          )}
          {!detailLoading && !gameState && (
            <div className="records-placeholder">
              {games.length === 0
                ? "対戦記録が存在しません。"
                : "左の一覧からゲームを選択してください。"}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
