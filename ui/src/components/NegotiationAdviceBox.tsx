import { useContext, useState } from "react";
import { useParams } from "react-router";
import { Button, CircularProgress } from "@mui/material";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";

import { requestNegotiationAdvice, type StateIndex } from "../utils/apiClient";
import { store } from "../store";

import "./AnalysisBox.scss";
import "./NegotiationAdviceBox.scss";

const RESOURCE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bwood\b/gi, "木材"],
  [/\bbrick\b/gi, "レンガ"],
  [/\bsheep\b/gi, "羊毛"],
  [/\bwheat\b/gi, "小麦"],
  [/\bore\b/gi, "鉱石"],
  [/ウッド/g, "木材"],
  [/ブリック/g, "レンガ"],
  [/シープ/g, "羊毛"],
  [/ウィート/g, "小麦"],
  [/オレ/g, "鉱石"],
];

const DEV_CARD_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bknight\b/gi, "騎士"],
  [/\bmonopoly\b/gi, "独占"],
  [/\byear of plenty\b/gi, "豊穣の年"],
  [/\broad building\b/gi, "街道建設"],
];

function localizeAdviceText(text: string): string {
  let output = text.replace(/\*\*/g, "");
  [...RESOURCE_REPLACEMENTS, ...DEV_CARD_REPLACEMENTS].forEach(
    ([pattern, replacement]) => {
      output = output.replace(pattern, replacement);
    }
  );
  return output;
}

type NegotiationAdviceBoxProps = {
  stateIndex: StateIndex;
};

export default function NegotiationAdviceBox({
  stateIndex,
}: NegotiationAdviceBoxProps) {
  const { gameId } = useParams();
  const { state } = useContext(store);
  const [advice, setAdvice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAdviceRequest = async () => {
    if (!gameId || !state.gameState) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      const result = await requestNegotiationAdvice(gameId, stateIndex);
      if (result.success && result.advice) {
        setAdvice(localizeAdviceText(result.advice));
      } else {
        setAdvice("");
        setError(result.error || "アドバイスの取得に失敗しました");
      }
    } catch (err) {
      console.error("Failed to request negotiation advice:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else if (typeof err === "string") {
        setError(err);
      } else {
        setError("アドバイスの取得中に不明なエラーが発生しました");
      }
    } finally {
      setLoading(false);
    }
  };

  const buttonDisabled = loading || !gameId || !state.gameState;

  return (
    <div className="analysis-box negotiation-box">
      <div className="analysis-header">
        <h3>交渉アドバイス</h3>
        <Button
          variant="contained"
          color="primary"
          onClick={handleAdviceRequest}
          disabled={buttonDisabled}
          startIcon={loading ? <CircularProgress size={20} /> : <RecordVoiceOverIcon />}
        >
          {loading ? "送信中..." : "アドバイス取得"}
        </Button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {advice ? (
        <div className="advice-output">{advice}</div>
      ) : (
        <p className="advice-placeholder">
          盤面と直近の行動ログをChatGPTに送り、トレードや交渉のヒントを取得します。
        </p>
      )}
    </div>
  );
}
