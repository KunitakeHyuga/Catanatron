import { Paper } from "@mui/material";
import { type PlayerState } from "../utils/api.types";
import { type Card } from "../utils/api.types";
import { cardLabel } from "../utils/i18n";

// TODO - do we need to split the SCSS for this component?
import "./PlayerStateBox.scss";

export default function ResourceCards({ playerState, playerKey }: { playerState: PlayerState; playerKey: string }) {
  const amount = (card: Card) => playerState[`${playerKey}_${card}_IN_HAND`];
  return (
    <div className="resource-cards" title="資源カード">
      <div className={`wood-cards center-text card ${amount("WOOD") ? "has-card" : ""}`}>
        <Paper>{amount("WOOD")}</Paper>
      </div>
      <div className={`brick-cards center-text card ${amount("BRICK") ? "has-card" : ""}`}>
        <Paper>{amount("BRICK")}</Paper>
      </div>
      <div className={`sheep-cards center-text card ${amount("SHEEP") ? "has-card" : ""}`}>
        <Paper>{amount("SHEEP")}</Paper>
      </div>
      <div className={`wheat-cards center-text card ${amount("WHEAT") ? "has-card" : ""}`}>
        <Paper>{amount("WHEAT")}</Paper>
      </div>
      <div className={`ore-cards center-text card ${amount("ORE") ? "has-card" : ""}`}>
        <Paper>{amount("ORE")}</Paper>
      </div>
      <div className="separator"></div>
      {(["VICTORY_POINT","KNIGHT","MONOPOLY","YEAR_OF_PLENTY","ROAD_BUILDING"] as Card[]).map((card) => (
        <div
          key={card}
          className={`dev-cards center-text card ${amount(card) ? "has-card" : ""}`}
          title={`${amount(card)}枚の${cardLabel(card)}`}
        >
          <Paper>
            <span className="card-label">
              {card === "VICTORY_POINT"
                ? "勝利点"
                : card === "KNIGHT"
                ? "騎士"
                : card === "MONOPOLY"
                ? "独占"
                : card === "YEAR_OF_PLENTY"
                ? "豊穣"
                : "街道"}
            </span>
            <span className="card-count">{amount(card)}</span>
          </Paper>
        </div>
      ))}
    </div>
  );
}
