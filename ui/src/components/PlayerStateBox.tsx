import cn from "classnames";

import "./PlayerStateBox.scss";
import { type Color, type PlayerState } from "../utils/api.types";
import ResourceCards from "./ResourceCards";
import { colorLabel } from "../utils/i18n";

type PlayerStateBoxProps = {
  playerState: PlayerState;
  playerKey: string;
  color: Color;
  playerName?: string | null;
};

export default function PlayerStateBox({
  playerState,
  playerKey,
  color,
  playerName,
}: PlayerStateBoxProps) {
  const actualVps = playerState[`${playerKey}_ACTUAL_VICTORY_POINTS`];
  const label = playerName
    ? `${colorLabel(color)}（${playerName}）`
    : colorLabel(color);
  return (
    <div className={cn("player-state-box foreground", color)}>
      <div className="player-header">
        <span className="player-name">{label}</span>
        <span className="player-label">の所持カード</span>
      </div>
      <ResourceCards playerState={playerState} playerKey={playerKey} />
      <div className="scores">
        <div
          className={cn("num-knights center-text", {
            bold: playerState[`${playerKey}_HAS_ARMY`],
          })}
          title="最大騎士力"
        >
          <span>{playerState[`${playerKey}_PLAYED_KNIGHT`]}</span>
          <small>最大騎士力</small>
        </div>
        <div
          className={cn("num-roads center-text", {
            bold: playerState[`${playerKey}_HAS_ROAD`],
          })}
          title="最長交易路"
        >
          {playerState[`${playerKey}_LONGEST_ROAD_LENGTH`]}
          <small>最長交易路</small>
        </div>
        <div
          className={cn("victory-points center-text", {
            bold: actualVps >= 10,
          })}
          title="勝利点"
        >
          {actualVps}
          <small>現在の勝利点</small>
        </div>
      </div>
    </div>
  );
}
