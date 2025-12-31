import { useEffect, useState, useContext, useCallback, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import PropTypes from "prop-types";
import { GridLoader } from "react-spinners";
import { useSnackbar } from "notistack";

import ZoomableBoard from "./ZoomableBoard";
import ActionsToolbar from "./ActionsToolbar";

import "./GameScreen.scss";
import LeftDrawer from "../components/LeftDrawer";
import RightDrawer from "../components/RightDrawer";
import { store } from "../store";
import ACTIONS from "../actions";
import { type StateIndex, getState, postAction } from "../utils/apiClient";
import { dispatchSnackbar } from "../components/Snackbar";
import { getHumanColor } from "../utils/stateUtils";
import AnalysisBox from "../components/AnalysisBox";
import NegotiationAdviceBox from "../components/NegotiationAdviceBox";
import { Button, Divider } from "@mui/material";
import DiceDisplay from "../components/DiceDisplay";
import useRollDisplay from "../hooks/useRollDisplay";
import RollingDiceOverlay from "../components/RollingDiceOverlay";
import { colorLabel } from "../utils/i18n";
import TurnIndicator from "../components/TurnIndicator";
import BuildCostGuide from "../components/BuildCostGuide";
import { upsertLocalRecord } from "../utils/localRecords";
import type { GameAction, GameState } from "../utils/api.types";

const HUMAN_BOT_DELAY_MS = 2500;
const DICE_ROLL_DELAY_MS = 4000;

function GameScreen({ replayMode }: { replayMode: boolean }) {
  const { gameId, stateIndex } = useParams();
  const { state, dispatch } = useContext(store);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [isBotThinking, setIsBotThinking] = useState(false);
  const botDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botProcessingRef = useRef(false);

  // Load game state
  useEffect(() => {
    if (!gameId) {
      return;
    }

    (async () => {
      const gameState = await getState(gameId, stateIndex as StateIndex);
      dispatch({ type: ACTIONS.SET_GAME_STATE, data: gameState });
    })();
  }, [gameId, stateIndex, dispatch]);

  // Track unmount to avoid state updates on unmounted component
  const isUnmountedRef = useRef(false);
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      if (botDelayTimeoutRef.current) {
        clearTimeout(botDelayTimeoutRef.current);
        botDelayTimeoutRef.current = null;
      }
    };
  }, []);

  const gameState = state.gameState;
  const currentStateIndex = gameState?.state_index;
  const isBotTurn = (state: GameState) =>
    state.bot_colors.includes(state.current_color) && !state.winning_color;
  const hasHumanPlayer =
    gameState?.has_human_player ??
    (gameState
      ? gameState.colors.some(
          (color) => !gameState.bot_colors.includes(color)
        )
      : false);

  // Maybe kick off next query?
  useEffect(() => {
    if (!gameState || replayMode || !gameId) {
      setIsBotThinking(false);
      return;
    }
    if (!isBotTurn(gameState) || botProcessingRef.current) {
      return;
    }

    botProcessingRef.current = true;
    let cancelled = false;

    const wait = async (ms: number) => {
      if (ms <= 0 || cancelled) {
        return;
      }
      await new Promise<void>((resolve) => {
        botDelayTimeoutRef.current = setTimeout(() => {
          botDelayTimeoutRef.current = null;
          resolve();
        }, ms);
      });
    };

    const processBots = async () => {
      let nextState = gameState;
      try {
        while (!cancelled && isBotTurn(nextState)) {
          const shouldDelayBeforeAction =
            hasHumanPlayer && !nextState.is_initial_build_phase;
          setIsBotThinking(shouldDelayBeforeAction);

          if (shouldDelayBeforeAction) {
            await wait(HUMAN_BOT_DELAY_MS);
          }

          const updatedState = await postAction(gameId);

          if (cancelled) {
            break;
          }

          dispatch({ type: ACTIONS.SET_GAME_STATE, data: updatedState });
          if (getHumanColor(updatedState)) {
            dispatchSnackbar(enqueueSnackbar, closeSnackbar, updatedState);
          }

          nextState = updatedState;
        }
      } catch (error) {
        console.error("Failed to process bot action", error);
      } finally {
        if (botDelayTimeoutRef.current) {
          clearTimeout(botDelayTimeoutRef.current);
          botDelayTimeoutRef.current = null;
        }
        setIsBotThinking(false);
        botProcessingRef.current = false;
      }
    };

    processBots();

    return () => {
      cancelled = true;
      if (botDelayTimeoutRef.current) {
        clearTimeout(botDelayTimeoutRef.current);
        botDelayTimeoutRef.current = null;
      }
      setIsBotThinking(false);
      botProcessingRef.current = false;
    };
  }, [
    gameId,
    replayMode,
    currentStateIndex,
    dispatch,
    enqueueSnackbar,
    closeSnackbar,
    gameState,
    hasHumanPlayer,
  ]);

  const { displayRoll, overlayRoll, overlayVisible, finalizeOverlay } =
    useRollDisplay(state.gameState);

  useEffect(() => {
    if (!gameId || !state.gameState || replayMode) {
      return;
    }
    upsertLocalRecord(gameId, state.gameState);
  }, [gameId, state.gameState, replayMode]);

  const executePlayerAction = useCallback(
    async (action?: GameAction) => {
      if (!gameId) {
        throw new Error("gameId が必要です");
      }
      return postAction(gameId, action);
    },
    [gameId]
  );

  const humanColor = state.gameState ? getHumanColor(state.gameState) : null;
  const turnLabel = state.gameState
    ? `${colorLabel(state.gameState.current_color)}${
        humanColor && humanColor === state.gameState.current_color
          ? "（あなた）"
          : ""
      }`
    : undefined;
  const turnPillClass = state.gameState
    ? `turn-pill-${state.gameState.current_color.toLowerCase()}`
    : undefined;

  if (!state.gameState) {
    return (
      <main className="loading-screen">
        <div className="loading-card">
          <GridLoader color="#ffffff" size={80} />
          <p>ロード中です。少々お待ちください…</p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1 className="logo">Catanatron</h1>
      <TurnIndicator gameState={state.gameState} />
      <RollingDiceOverlay
        roll={overlayRoll}
        visible={overlayVisible}
        currentTurnLabel={turnLabel}
        currentColorClass={turnPillClass}
        onComplete={finalizeOverlay}
      />
      <ZoomableBoard
        replayMode={replayMode}
        actionExecutor={executePlayerAction}
      />
      <div className="game-actions-floating">
        <ActionsToolbar
          isBotThinking={isBotThinking}
          replayMode={replayMode}
          actionExecutor={executePlayerAction}
          showResources={false}
        />
      </div>
      {state.gameState.winning_color && (
        <div className="game-end-actions">
          <Button
            component={Link}
            to="/"
            variant="contained"
            color="secondary"
          >
            ホームに戻る
          </Button>
        </div>
      )}
      <LeftDrawer viewerColor={humanColor ?? null} />
      <RightDrawer>
        <AnalysisBox stateIndex={"latest"} />
        <Divider />
        <NegotiationAdviceBox stateIndex={"latest"} />
        <Divider />
        <DiceDisplay roll={displayRoll} />
        <Divider />
        <BuildCostGuide />
      </RightDrawer>
    </main>
  );
}

GameScreen.propTypes = {
  /**
   * Injected by the documentation to work in an iframe.
   * You won't need it on your project.
   */
  window: PropTypes.func,
};

export default GameScreen;
