import type { GameState } from "../utils/api.types";
import { colorLabel } from "../utils/i18n";
import { getHumanColor } from "../utils/stateUtils";

import "./TurnIndicator.scss";

export default function TurnIndicator({ gameState }: { gameState: GameState | null }) {
  if (!gameState) {
    return null;
  }
  const humanColor = getHumanColor(gameState);
  const label = `${colorLabel(gameState.current_color)}${
    humanColor && humanColor === gameState.current_color ? "（あなた）" : ""
  }`;
  const pillClass = `turn-pill turn-pill-${gameState.current_color.toLowerCase()}`;

  return (
    <div className="turn-indicator">
      <span className="turn-label">現在の番:</span>
      <span className={pillClass}>{label}</span>
    </div>
  );
}
