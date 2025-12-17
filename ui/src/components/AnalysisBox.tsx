import { useContext, useState } from "react";
import { CircularProgress, Button } from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { type MCTSProbabilities, type StateIndex, getMctsAnalysis } from "../utils/apiClient";
import { useParams } from "react-router";

import "./AnalysisBox.scss";
import { store } from "../store";
import { colorLabel } from "../utils/i18n";
import type { Color } from "../utils/api.types";

type AnalysisBoxProps = {
    stateIndex: StateIndex;
}

export default function AnalysisBox( { stateIndex }: AnalysisBoxProps ) {
  const { gameId } = useParams();
  const { state } = useContext(store);
  const [mctsResults, setMctsResults] = useState<MCTSProbabilities | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyzeClick = async () => {
    if (!gameId || !state.gameState || state.gameState.winning_color) return;

    try {
      setLoading(true);
      setError('');
      const result = await getMctsAnalysis(gameId, stateIndex);
      if (result.success) {
        setMctsResults(result.probabilities);
      } else {
        setError(result.error || "解析に失敗しました");
      }
    } catch (err) {
      console.error("MCTS解析に失敗しました:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else if (typeof err === "string") {
        setError(err);
      } else {
        setError("原因不明のエラーが発生しました");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analysis-box">
      <div className="analysis-header">
        <h3>勝率解析</h3>
        <Button
          variant="contained"
          color="primary"
          onClick={handleAnalyzeClick}
          disabled={loading || !!state.gameState?.winning_color}
          startIcon={loading ? <CircularProgress size={20} /> : <AssessmentIcon />}
        >
          {loading ? "解析中..." : "解析する"}
        </Button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {mctsResults && !loading && !error && (
        <div className="probability-bars">
          {Object.entries(mctsResults).map(([color, probability]) => (
            <div key={color} className={`probability-row ${color.toLowerCase()}`}>
              <span className="player-color">{colorLabel(color as Color)}</span>
              <span className="probability-bar">
                <div
                  className="bar-fill"
                  style={{ width: `${probability}%` }}
                />
              </span>
              <span className="probability-value">{probability}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
