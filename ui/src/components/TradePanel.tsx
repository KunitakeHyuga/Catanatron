import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Button } from "@mui/material";
import HandshakeIcon from "@mui/icons-material/Handshake";
import { useSnackbar } from "notistack";

import ACTIONS from "../actions";
import { store } from "../store";
import {
  type GameAction,
  type GameState,
  type ResourceCard,
  type ResourceCounts,
  type OfferTradeAction,
  type AcceptTradeAction,
  type RejectTradeAction,
  type ConfirmTradeAction,
  type CancelTradeAction,
  type TradeSummary,
  type Color,
} from "../utils/api.types";
import { getHumanColor, playerKey } from "../utils/stateUtils";
import { colorLabel, resourceLabel } from "../utils/i18n";
import { dispatchSnackbar } from "./Snackbar";
import CollapsibleSection from "./CollapsibleSection";

import "./TradePanel.scss";

const RESOURCE_ORDER: ResourceCard[] = [
  "WOOD",
  "BRICK",
  "SHEEP",
  "WHEAT",
  "ORE",
];

const createEmptyCounts = (): ResourceCounts => [0, 0, 0, 0, 0];

type TradePanelProps = {
  actionExecutor?: (action?: GameAction) => Promise<GameState>;
  playerColorOverride?: Color | null;
};

function formatCounts(counts: ResourceCounts): string {
  const labels = counts
    .map((count, index) =>
      count > 0 ? `${resourceLabel(RESOURCE_ORDER[index])}×${count}` : null
    )
    .filter(Boolean);
  return labels.length > 0 ? labels.join(" + ") : "なし";
}

function TradeSummaryView({ trade }: { trade: TradeSummary }) {
  return (
    <div className="trade-status-card">
      <div className="trade-summary-line">
        <span className="trade-summary-offerer">
          {colorLabel(trade.offerer_color)}の提案
        </span>
        <span className="trade-summary-details">
          {formatCounts(trade.offer)} → {formatCounts(trade.request)}
        </span>
      </div>
      <div className="trade-acceptances">
        {trade.acceptees.length === 0 ? (
          <span className="trade-acceptance waiting">回答待ち</span>
        ) : (
          trade.acceptees.map(({ color, accepted }) => (
            <span
              key={color}
              className={`trade-acceptance ${accepted ? "accepted" : "waiting"}`}
            >
              {colorLabel(color)}: {accepted ? "承諾" : "回答待ち"}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export default function TradePanel({
  actionExecutor,
  playerColorOverride = null,
}: TradePanelProps) {
  const { state, dispatch } = useContext(store);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [offer, setOffer] = useState<ResourceCounts>(() => createEmptyCounts());
  const [request, setRequest] = useState<ResourceCounts>(() =>
    createEmptyCounts()
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const gameState = state.gameState;
  const humanColor =
    gameState && playerColorOverride
      ? playerColorOverride
      : gameState
      ? getHumanColor(gameState)
      : null;

  const availableCounts = useMemo<ResourceCounts>(() => {
    if (!gameState || !humanColor) {
      return createEmptyCounts();
    }
    const key = playerKey(gameState, humanColor);
    return RESOURCE_ORDER.map(
      (resource) => gameState.player_state[`${key}_${resource}_IN_HAND`] ?? 0
    ) as ResourceCounts;
  }, [gameState, humanColor]);

  useEffect(() => {
    setOffer((prev) =>
      prev.map((count, index) =>
        Math.min(count, availableCounts[index])
      ) as ResourceCounts
    );
  }, [availableCounts]);

  const submitAction = useCallback(
    async (action: GameAction, options?: { resetForm?: boolean }) => {
      if (!actionExecutor) {
        return;
      }
      try {
        setPendingAction(action[1]);
        const updatedState = await actionExecutor(action);
        dispatch({ type: ACTIONS.SET_GAME_STATE, data: updatedState });
        dispatchSnackbar(enqueueSnackbar, closeSnackbar, updatedState);
        if (options?.resetForm) {
          setOffer(createEmptyCounts());
          setRequest(createEmptyCounts());
        }
      } catch (error) {
        console.error("交渉アクションの送信に失敗しました:", error);
        enqueueSnackbar("交渉アクションの送信に失敗しました。", {
          variant: "error",
        });
      } finally {
        setPendingAction(null);
      }
    },
    [actionExecutor, dispatch, enqueueSnackbar, closeSnackbar]
  );

  const tradeTitle = (
    <span className="trade-panel-heading">
      <span className="trade-title-icon">
        <HandshakeIcon fontSize="small" />
      </span>
      <span className="trade-title-text">交渉</span>
    </span>
  );

  if (!gameState) {
    return (
      <CollapsibleSection className="analysis-box trade-panel" title={tradeTitle}>
        <p className="trade-placeholder">ゲーム情報を読み込み中です。</p>
      </CollapsibleSection>
    );
  }

  if (!humanColor) {
    return (
      <CollapsibleSection className="analysis-box trade-panel" title={tradeTitle}>
        <p className="trade-placeholder">人間プレイヤーが参加していません。</p>
      </CollapsibleSection>
    );
  }

  const humanKey = playerKey(gameState, humanColor);
  const hasRolled = Boolean(gameState.player_state[`${humanKey}_HAS_ROLLED`]);
  const isPlayersTurn =
    gameState.current_color === humanColor &&
    gameState.current_prompt === "PLAY_TURN";
  const tradeActive = Boolean(gameState.trade);
  const gameFinished = Boolean(gameState.winning_color);

  const offerTotal = offer.reduce((sum, count) => sum + count, 0);
  const requestTotal = request.reduce((sum, count) => sum + count, 0);

  let validationError: string | null = null;
  const insufficientIndex = offer.findIndex(
    (count, index) => count > availableCounts[index]
  );
  if (insufficientIndex >= 0) {
    validationError = `${resourceLabel(
      RESOURCE_ORDER[insufficientIndex]
    )}が足りません`;
  } else if (
    offer.some((count, index) => count > 0 && request[index] > 0)
  ) {
    validationError = "同じ資源を同時に渡すことはできません";
  } else if (offerTotal === 0) {
    validationError = "最低1枚は差し出してください";
  } else if (requestTotal === 0) {
    validationError = "最低1枚は要求してください";
  }

  const handleAdjust =
    (
      setter: React.Dispatch<React.SetStateAction<ResourceCounts>>,
      limit?: (index: number) => number
    ) =>
    (index: number, delta: number) => {
      setter((prev) => {
        const next = [...prev] as ResourceCounts;
        const upperBound =
          typeof limit === "function" ? limit(index) : Number.POSITIVE_INFINITY;
        next[index] = Math.max(
          0,
          Math.min(upperBound, next[index] + delta)
        );
        return next;
      });
    };

  const incrementOffer = handleAdjust(
    setOffer,
    (index) => availableCounts[index]
  );
  const decrementOffer = handleAdjust(setOffer);
  const incrementRequest = handleAdjust(setRequest);
  const decrementRequest = handleAdjust(setRequest);

  const resetForm = () => {
    setOffer(createEmptyCounts());
    setRequest(createEmptyCounts());
  };

  const handleProposeTrade = () => {
    if (!humanColor) {
      return;
    }
    const payload = [...offer, ...request] as OfferTradeAction[2];
    const action: OfferTradeAction = [
      humanColor,
      "OFFER_TRADE",
      payload,
    ];
    submitAction(action, { resetForm: true });
  };

  const awaitingResponse =
    gameState.current_prompt === "DECIDE_TRADE" &&
    gameState.current_color === humanColor;
  const decidingPartner =
    gameState.current_prompt === "DECIDE_ACCEPTEES" &&
    gameState.current_color === humanColor;

  const acceptAction = awaitingResponse
    ? (gameState.current_playable_actions.find(
        (action) => action[1] === "ACCEPT_TRADE"
      ) as AcceptTradeAction | undefined)
    : undefined;
  const rejectAction = awaitingResponse
    ? (gameState.current_playable_actions.find(
        (action) => action[1] === "REJECT_TRADE"
      ) as RejectTradeAction | undefined)
    : undefined;
  const confirmActions = decidingPartner
    ? (gameState.current_playable_actions.filter(
        (action) => action[1] === "CONFIRM_TRADE"
      ) as ConfirmTradeAction[])
    : [];
  const currentTrade = gameState.trade ?? null;
  const isTradeOfferer =
    currentTrade && humanColor
      ? currentTrade.offerer_color === humanColor
      : false;
  const canProposeTrade =
    isPlayersTurn &&
    hasRolled &&
    !gameFinished &&
    (!tradeActive || isTradeOfferer);
  const proposeDisabledReason = !isPlayersTurn
    ? "あなたの番になるまで交渉は提案できません。"
    : !hasRolled
    ? "ダイスを振るまでは交渉できません。"
    : tradeActive && !isTradeOfferer
    ? "現在処理中の交渉が終わるまでお待ちください。"
    : gameFinished
    ? "ゲームが終了しています。"
    : null;
  const canSubmitProposal =
    canProposeTrade &&
    !validationError &&
    pendingAction === null &&
    offerTotal > 0 &&
    requestTotal > 0;
  const withdrawAction: CancelTradeAction | undefined =
    tradeActive && isTradeOfferer && humanColor
      ? [humanColor, "CANCEL_TRADE", null]
      : undefined;
  const acceptedColors =
    currentTrade?.acceptees
      ?.filter(({ accepted }) => accepted)
      .map(({ color }) => color) ?? [];
  const hasAcceptedPartners = acceptedColors.length > 0;
  const noAcceptanceYet = !hasAcceptedPartners;
  const hasRejectedPlayers =
    decidingPartner && currentTrade
      ? currentTrade.acceptees.some(
          ({ accepted, color }) => !accepted && color !== currentTrade.offerer_color
        )
      : false;
  const rejectedColors = hasRejectedPlayers
    ? currentTrade?.acceptees
        ?.filter(
          ({ accepted, color }) => !accepted && color !== currentTrade.offerer_color
        )
        .map(({ color }) => color as Color) ?? []
    : [];
  const currentResponderColor =
    currentTrade &&
    gameState.current_prompt === "DECIDE_TRADE" &&
    !isTradeOfferer
      ? null
      : currentTrade && gameState.current_prompt === "DECIDE_TRADE"
      ? gameState.current_color
      : null;
  const waitingColors =
    currentTrade?.acceptees
      ?.filter(({ accepted }) => !accepted)
      .map(({ color }) => color) ?? [];

  return (
    <CollapsibleSection className="analysis-box trade-panel" title={tradeTitle}>
      {currentTrade ? (
        <>
          <TradeSummaryView trade={currentTrade} />
          {isTradeOfferer && (
            <div className="trade-status-note">
              {hasAcceptedPartners ? (
                <p>
                  {acceptedColors
                    .map((color) => colorLabel(color as Color))
                    .join("・")}
                  が交渉に応じています。全員の回答が終わると、成立させる相手を選べます。
                </p>
              ) : (
                <p>まだ誰も交渉に応じていません。各プレイヤーの回答を待っています。</p>
              )}
              {currentResponderColor && (
                <p className="waiting-note">
                  現在 {colorLabel(currentResponderColor)} が交渉に応じるか判断しています。
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="trade-placeholder">現在提案中の交渉はありません。</p>
      )}

      {awaitingResponse && !isTradeOfferer && (acceptAction || rejectAction) && (
        <div className="trade-response">
          <p>この交渉提案に応じますか？</p>
          <div className="trade-response-buttons">
            <Button
              variant="contained"
              color="primary"
              disabled={!acceptAction || pendingAction !== null}
              onClick={() => acceptAction && submitAction(acceptAction)}
            >
              受け入れる
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              disabled={!rejectAction || pendingAction !== null}
              onClick={() => rejectAction && submitAction(rejectAction)}
            >
              断る
            </Button>
          </div>
        </div>
      )}

      {decidingPartner && (
        <div className="trade-response">
          <p>
            {hasAcceptedPartners
              ? `${acceptedColors
                  .map((color) => colorLabel(color as Color))
                  .join("・")} が交渉に応じました。成立させる相手を選ぶか、交渉を取り下げてください。`
              : "成立させる相手を選んでください。"}
          </p>
          <div className="trade-response-buttons">
            {confirmActions.map((action) => {
              const target = action[2][10] as Color;
              return (
                <Button
                  key={String(target)}
                  variant="contained"
                  color="primary"
                  disabled={pendingAction !== null || hasRejectedPlayers}
                  onClick={() => submitAction(action)}
                >
                  {colorLabel(target)}と成立
                </Button>
              );
            })}
            {withdrawAction && (
              <Button
                variant="outlined"
                color="inherit"
                disabled={pendingAction !== null}
                onClick={() => submitAction(withdrawAction)}
              >
                交渉を取り下げる
              </Button>
            )}
          </div>
          {hasRejectedPlayers && (
            <p className="trade-reject-note">
              {rejectedColors
                .map((color) => colorLabel(color))
                .join("・")}
              が交渉を断ったため、成立はできません。交渉を取り下げてください。
            </p>
          )}
        </div>
      )}

      {withdrawAction && !decidingPartner && (
        <div className="trade-response">
          <p>
            {noAcceptanceYet
              ? "まだ誰も交渉に応じていません。交渉を取り下げますか？"
              : hasAcceptedPartners
              ? `${acceptedColors
                  .map((color) => colorLabel(color as Color))
                  .join("・")} が交渉に応じています。今すぐ交渉を取り下げることもできます。`
              : "交渉を取り下げますか？"}
          </p>
          {rejectedColors.length > 0 && (
            <p className="trade-reject-note">
              {rejectedColors
                .map((color) => colorLabel(color))
                .join("・")}
              が交渉を断りました。
            </p>
          )}
          <div className="trade-response-buttons">
            <Button
              variant="outlined"
              color="inherit"
              disabled={pendingAction !== null}
              onClick={() => submitAction(withdrawAction)}
            >
              交渉を取り下げる
            </Button>
          </div>
        </div>
      )}

      <div className="trade-form">
        <h4>新しい交渉を提案</h4>
        {proposeDisabledReason && (
          <p className="trade-hint">{proposeDisabledReason}</p>
        )}
        <div className="trade-grid">
          <div className="trade-grid-head">
            <span>資源</span>
            <span>渡す</span>
            <span>受け取る</span>
            <span>所持</span>
          </div>
          {RESOURCE_ORDER.map((resource, index) => (
            <div className="trade-row" key={resource}>
              <span className="resource-name">{resourceLabel(resource)}</span>
              <div className="trade-counter">
                <button
                  type="button"
                  onClick={() => decrementOffer(index, -1)}
                  aria-label="decrease offer"
                >
                  −
                </button>
                <span>{offer[index]}</span>
                <button
                  type="button"
                  onClick={() => incrementOffer(index, 1)}
                  aria-label="increase offer"
                  disabled={offer[index] >= availableCounts[index]}
                >
                  ＋
                </button>
              </div>
              <div className="trade-counter">
                <button
                  type="button"
                  onClick={() => decrementRequest(index, -1)}
                  aria-label="decrease request"
                >
                  −
                </button>
                <span>{request[index]}</span>
                <button
                  type="button"
                  onClick={() => incrementRequest(index, 1)}
                  aria-label="increase request"
                >
                  ＋
                </button>
              </div>
              <span className="resource-available">
                {availableCounts[index]}
              </span>
            </div>
          ))}
        </div>
        {validationError && (
          <div className="trade-error">{validationError}</div>
        )}
        <div className="trade-actions">
          <Button
            variant="text"
            color="inherit"
            onClick={resetForm}
            disabled={pendingAction !== null || (offerTotal === 0 && requestTotal === 0)}
          >
            リセット
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!canSubmitProposal}
            onClick={handleProposeTrade}
          >
            {pendingAction === "OFFER_TRADE" ? "送信中..." : "交渉を提案"}
          </Button>
        </div>
      </div>
    </CollapsibleSection>
  );
}
