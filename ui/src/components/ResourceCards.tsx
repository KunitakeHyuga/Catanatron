import cn from "classnames";
import { Paper } from "@mui/material";
import { type PlayerState } from "../utils/api.types";
import { type Card, type ResourceCard } from "../utils/api.types";
import { cardLabel, resourceLabel } from "../utils/i18n";

// TODO - do we need to split the SCSS for this component?
import "./PlayerStateBox.scss";

const RESOURCE_CARDS: ResourceCard[] = [
  "WOOD",
  "BRICK",
  "SHEEP",
  "WHEAT",
  "ORE",
];
const DEV_CARDS: Card[] = [
  "VICTORY_POINT",
  "KNIGHT",
  "MONOPOLY",
  "YEAR_OF_PLENTY",
  "ROAD_BUILDING",
];

type ResourceCardsProps = {
  playerState: PlayerState;
  playerKey: string;
  wrapDevCards?: boolean;
};

export default function ResourceCards({
  playerState,
  playerKey,
  wrapDevCards = true,
}: ResourceCardsProps) {
  const amount = (card: Card) => playerState[`${playerKey}_${card}_IN_HAND`];
  return (
    <div
      className={cn("resource-cards", {
        "wrap-layout": wrapDevCards,
        "inline-layout": !wrapDevCards,
      })}
      title="資源カード"
    >
      {RESOURCE_CARDS.map((card) => (
        <div
          key={card}
          className={`${card.toLowerCase()}-cards resource-card center-text card ${
            amount(card) ? "has-card" : ""
          }`}
        >
          <Paper
            className={`card-surface resource-card-surface ${card.toLowerCase()}-surface`}
          >
            <span className="card-label">{resourceLabel(card)}</span>
            <span className="card-count">{amount(card)}</span>
          </Paper>
        </div>
      ))}
      <div className="separator"></div>
      {DEV_CARDS.map((card) => (
        <div
          key={card}
          className={`dev-cards center-text card ${amount(card) ? "has-card" : ""}`}
          title={`${amount(card)}枚の${cardLabel(card)}`}
        >
          <Paper className="card-surface dev-card-surface">
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
