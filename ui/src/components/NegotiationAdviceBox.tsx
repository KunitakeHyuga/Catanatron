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

function extractNegotiationSections(text: string): string {
  const adviceHeading = "## 交渉アドバイス";
  const imageHeading = "### 盤面画像の気づき";
  const loadHeading = "## 判断負荷推定";

  let workingText = text;
  const loadIndex = workingText.indexOf(loadHeading);
  if (loadIndex >= 0) {
    const afterLoad = workingText.slice(loadIndex + loadHeading.length);
    const nextSectionMatch = afterLoad.match(/\n##\s+[^\n]+/);
    const loadEnd =
      nextSectionMatch && nextSectionMatch.index !== undefined
        ? loadIndex + loadHeading.length + nextSectionMatch.index
        : workingText.length;
    workingText =
      workingText.slice(0, loadIndex).trimEnd() +
      "\n\n" +
      workingText.slice(loadEnd).trimStart();
  }

  const parts: string[] = [];

  const adviceIndex = workingText.indexOf(adviceHeading);
  if (adviceIndex >= 0) {
    const adviceContent = workingText
      .slice(adviceIndex + adviceHeading.length)
      .trim();
    if (adviceContent) {
      parts.push(`交渉アドバイス\n${adviceContent}`);
    }
  }

  const imageIndex = workingText.indexOf(imageHeading);
  if (imageIndex >= 0) {
    const imageEnd =
      adviceIndex >= 0 && adviceIndex > imageIndex
        ? adviceIndex
        : workingText.length;
    const imageContent = workingText.slice(imageIndex, imageEnd).trim();
    if (imageContent) {
      parts.unshift(imageContent);
    }
  }

  if (parts.length === 0) {
    return workingText;
  }
  return parts.join("\n\n");
}

function localizeAdviceText(text: string): string {
  let output = text.replace(/\*\*/g, "");
  output = extractNegotiationSections(output);
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
      await new Promise((resolve) => {
        requestAnimationFrame(() => resolve(undefined));
      });
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
      if (boardImageDataUrl) {
        console.debug(
          "Negotiation advice board image captured (length):",
          boardImageDataUrl.length
        );
        console.info(
          "Negotiation advice board image data URL:",
          boardImageDataUrl
        );
      } else {
        console.debug("Negotiation advice board image capture skipped.");
      }
      const result = await requestNegotiationAdvice(
        gameId,
        stateIndex,
        boardImageDataUrl
      );
      if (boardImageDataUrl) {
        console.info("Negotiation advice request sent with board image.");
      } else {
        console.info("Negotiation advice request sent without board image.");
      }
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
