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
  maskDevelopmentCards?: boolean;
  hideDevelopmentCards?: boolean;
};

export default function ResourceCards({
  playerState,
  playerKey,
  wrapDevCards = true,
  maskDevelopmentCards = false,
  hideDevelopmentCards = false,
}: ResourceCardsProps) {
  const amount = (card: Card) => playerState[`${playerKey}_${card}_IN_HAND`];
  const playedAmount = (card: Card) =>
    playerState[`${playerKey}_PLAYED_${card}`];
  const totalDevCardsInHand = DEV_CARDS.reduce(
    (sum, card) => sum + amount(card),
    0
  );
  const renderDevCards = () => {
    if (maskDevelopmentCards) {
      return (
        <>
          <div
            className={`dev-cards center-text card ${
              totalDevCardsInHand ? "has-card" : ""
            }`}
            title="未使用の発展カード"
          >
            <Paper className="card-surface dev-card-surface">
              <span className="card-label">未使用</span>
              <span className="card-count">{totalDevCardsInHand}</span>
            </Paper>
          </div>
          {DEV_CARDS.map((card) => {
            const played = playedAmount(card);
            return (
              <div
                key={`played-${card}`}
                className={`dev-cards center-text card ${
                  played ? "has-card" : ""
                }`}
                title={`${cardLabel(card)}（使用済み）`}
              >
                <Paper className="card-surface dev-card-surface">
                  <span className="card-label">{cardLabel(card)}</span>
                  <span className="card-count">{played}</span>
                </Paper>
              </div>
            );
          })}
        </>
      );
    }
    return (
      <>
        <div
          className={`dev-cards center-text card ${
            totalDevCardsInHand ? "has-card" : ""
          }`}
          title="未使用の発展カード"
        >
          <Paper className="card-surface dev-card-surface">
            <span className="card-label">未使用</span>
            <span className="card-count">{totalDevCardsInHand}</span>
          </Paper>
        </div>
        {DEV_CARDS.map((card) => (
          <div
            key={card}
            className={`dev-cards center-text card ${
              amount(card) ? "has-card" : ""
            }`}
            title={cardLabel(card)}
          >
            <Paper className="card-surface dev-card-surface">
              <span className="card-label">{cardLabel(card)}</span>
              <span className="card-count">{amount(card)}</span>
            </Paper>
          </div>
        ))}
      </>
    );
  };
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
      {!hideDevelopmentCards && (
        <>
          <div className="separator"></div>
          {renderDevCards()}
        </>
      )}
    </div>
  );
}
