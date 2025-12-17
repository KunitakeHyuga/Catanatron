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
      {amount("WOOD") !== 0 && (
        <div className="wood-cards center-text card">
          <Paper>{amount("WOOD")}</Paper>
        </div>
      )}
      {amount("BRICK") !== 0 && (
        <div className="brick-cards center-text card">
          <Paper>{amount("BRICK")}</Paper>
        </div>
      )}
      {amount("SHEEP") !== 0 && (
        <div className="sheep-cards center-text card">
          <Paper>{amount("SHEEP")}</Paper>
        </div>
      )}
      {amount("WHEAT") !== 0 && (
        <div className="wheat-cards center-text card">
          <Paper>{amount("WHEAT")}</Paper>
        </div>
      )}
      {amount("ORE") !== 0 && (
        <div className="ore-cards center-text card">
          <Paper>{amount("ORE")}</Paper>
        </div>
      )}
      <div className="separator"></div>
      {amount("VICTORY_POINT") !== 0 && (
        <div
          className="dev-cards center-text card"
          title={`${amount("VICTORY_POINT")}枚の${cardLabel("VICTORY_POINT")}`}
        >
          <Paper>
            <span>{amount("VICTORY_POINT")}</span>
            <span>勝利</span>
          </Paper>
        </div>
      )}
      {amount("KNIGHT") !== 0 && (
        <div
          className="dev-cards center-text card"
          title={`${amount("KNIGHT")}枚の${cardLabel("KNIGHT")}`}
        >
          <Paper>
            <span>{amount("KNIGHT")}</span>
            <span>騎士</span>
          </Paper>
        </div>
      )}
      {amount("MONOPOLY") !== 0 && (
        <div
          className="dev-cards center-text card"
          title={`${amount("MONOPOLY")}枚の${cardLabel("MONOPOLY")}`}
        >
          <Paper>
            <span>{amount("MONOPOLY")}</span>
            <span>独占</span>
          </Paper>
        </div>
      )}
      {amount("YEAR_OF_PLENTY") !== 0 && (
        <div
          className="dev-cards center-text card"
          title={`${amount("YEAR_OF_PLENTY")}枚の${cardLabel("YEAR_OF_PLENTY")}`}
        >
          <Paper>
            <span>{amount("YEAR_OF_PLENTY")}</span>
            <span>豊穣</span>
          </Paper>
        </div>
      )}
      {amount("ROAD_BUILDING") !== 0 && (
        <div
          className="dev-cards center-text card"
          title={`${amount("ROAD_BUILDING")}枚の${cardLabel("ROAD_BUILDING")}`}
        >
          <Paper>
            <span>{amount("ROAD_BUILDING")}</span>
            <span>街道</span>
          </Paper>
        </div>
      )}
    </div>
  );
}
