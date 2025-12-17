import { useEffect, useMemo, useState } from "react";
import type { GameState } from "../utils/api.types";

export type RollValue = [number, number];

type RollInfo = {
  roll: RollValue | null;
  key: string | null;
};

function extractLatestRoll(gameState: GameState | null): RollInfo {
  if (!gameState) {
    return { roll: null, key: null };
  }
  for (let i = gameState.action_records.length - 1; i >= 0; i--) {
    const record = gameState.action_records[i];
    if (record[0][1] === "ROLL") {
      const roll = record[1] as RollValue;
      const key = `${roll[0]}-${roll[1]}-${i}`;
      return { roll, key };
    }
  }
  return { roll: null, key: null };
}

export default function useRollDisplay(gameState: GameState | null) {
  const latest = useMemo(() => extractLatestRoll(gameState), [gameState]);
  const [displayRoll, setDisplayRoll] = useState<RollValue | null>(null);
  const [displayRollKey, setDisplayRollKey] = useState<string | null>(null);
  const [overlayRoll, setOverlayRoll] = useState<RollValue | null>(null);
  const [overlayKey, setOverlayKey] = useState<string | null>(null);

  useEffect(() => {
    if (!latest.roll || !latest.key) {
      if (!gameState) {
        setDisplayRoll(null);
        setDisplayRollKey(null);
        setOverlayRoll(null);
        setOverlayKey(null);
      }
      return;
    }

    if (!displayRollKey && !overlayKey) {
      setDisplayRoll(latest.roll);
      setDisplayRollKey(latest.key);
      return;
    }

    if (latest.key !== displayRollKey && latest.key !== overlayKey) {
      setOverlayRoll(latest.roll);
      setOverlayKey(latest.key);
    }
  }, [latest, displayRollKey, overlayKey, gameState]);

  const finalizeOverlay = () => {
    if (overlayKey && overlayRoll) {
      setDisplayRoll(overlayRoll);
      setDisplayRollKey(overlayKey);
    }
    setOverlayRoll(null);
    setOverlayKey(null);
  };

  return {
    displayRoll,
    displayRollKey,
    overlayRoll,
    overlayVisible: Boolean(overlayKey && overlayRoll),
    finalizeOverlay,
  };
}
