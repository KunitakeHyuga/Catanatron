import { useCallback, useContext, useRef, useState } from "react";
import { useParams } from "react-router";
import { Button, CircularProgress } from "@mui/material";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import PsychologyIcon from "@mui/icons-material/Psychology";

import {
  requestNegotiationAdvice,
  type StateIndex,
} from "../utils/apiClient";
import { store } from "../store";
import type { GameState } from "../utils/api.types";
import CollapsibleSection from "./CollapsibleSection";
import BoardSnapshot from "./BoardSnapshot";

import "./AnalysisBox.scss";
import "./NegotiationAdviceBox.scss";
import { loadHtmlToImage } from "../utils/htmlToImageLoader";

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
  [/RED/g, "赤"],
  [/BLUE/g, "青"],
  [/WHITE/g, "白"],
  [/ORANGE/g, "オレンジ"],
];

const DEV_CARD_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bknight\b/gi, "騎士"],
  [/\bmonopoly\b/gi, "独占"],
  [/\byear of plenty\b/gi, "豊穣の年"],
  [/\broad building\b/gi, "街道建設"],
];

function extractNegotiationAdvice(text: string): string {
  const heading = "## 交渉アドバイス";
  const index = text.indexOf(heading);
  if (index === -1) {
    return text;
  }
  const sliced = text.slice(index + heading.length).trim();
  return sliced ? `交渉アドバイス\n${sliced}` : "";
}

function localizeAdviceText(text: string): string {
  let output = text.replace(/\*\*/g, "");
  output = extractNegotiationAdvice(output);
  [...RESOURCE_REPLACEMENTS, ...DEV_CARD_REPLACEMENTS].forEach(
    ([pattern, replacement]) => {
      output = output.replace(pattern, replacement);
    }
  );
  return output.trim();
}

type NegotiationAdviceBoxProps = {
  stateIndex: StateIndex;
  gameIdOverride?: string | null;
  gameStateOverride?: GameState | null;
};

export default function NegotiationAdviceBox({
  stateIndex,
  gameIdOverride = null,
  gameStateOverride = null,
}: NegotiationAdviceBoxProps) {
  const { gameId: routeGameId } = useParams();
  const { state } = useContext(store);
  const [advice, setAdvice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const gameId = gameIdOverride ?? routeGameId ?? undefined;
  const currentGameState = gameStateOverride ?? state.gameState;
  const boardSnapshotRef = useRef<HTMLDivElement | null>(null);

  const captureBoardImage = useCallback(async () => {
    if (!boardSnapshotRef.current) {
      return null;
    }
    try {
      const htmlToImage = await loadHtmlToImage();
      const element = boardSnapshotRef.current;
      const backgroundColor =
        window.getComputedStyle(element).getPropertyValue("background-color") ||
        "#0b1628";
      return await htmlToImage.toJpeg(element, {
        quality: 0.95,
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor,
      });
    } catch (captureError) {
      console.warn(
        "Failed to capture board snapshot for negotiation advice:",
        captureError
      );
      return null;
    }
  }, []);

  const handleAdviceRequest = async () => {
    if (!gameId || !currentGameState) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      const boardImageDataUrl = await captureBoardImage();
      const result = await requestNegotiationAdvice(
        gameId,
        stateIndex,
        boardImageDataUrl
      );
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

  const buttonDisabled = loading || !gameId || !currentGameState;

  const adviceTitle = (
    <span className="analysis-title-text">
      <PsychologyIcon fontSize="small" />
      <span>交渉支援AIエージェント</span>
    </span>
  );

  return (
    <>
      <CollapsibleSection
        className="analysis-box negotiation-box"
        title={adviceTitle}
      >
        <div className="analysis-actions">
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
      </CollapsibleSection>
      {currentGameState && (
        <div className="negotiation-board-capture" aria-hidden="true">
          <BoardSnapshot ref={boardSnapshotRef} gameState={currentGameState} />
        </div>
      )}
    </>
  );
}
