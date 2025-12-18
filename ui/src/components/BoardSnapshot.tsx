import { useEffect, useMemo, useRef, useState } from "react";
import Board from "../pages/Board";
import type { GameState } from "../utils/api.types";

import "./BoardSnapshot.scss";

type BoardSnapshotProps = {
  gameState: GameState;
};

const MIN_BOARD_WIDTH = 280;
const MAX_BOARD_WIDTH = 900;
const BOARD_VERTICAL_OFFSET = 144 + 38 + 40;

export default function BoardSnapshot({ gameState }: BoardSnapshotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(480);
  const [boardHeight, setBoardHeight] = useState(320);

  const computeDimensions = useMemo(
    () =>
      (containerWidth: number) => {
        const width = Math.min(
          Math.max(containerWidth - 16, MIN_BOARD_WIDTH),
          MAX_BOARD_WIDTH
        );
        const height = Math.max(width * 0.62, 240);
        return { width, height };
      },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const update = () => {
      const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth;
      const { width, height } = computeDimensions(containerWidth);
      setBoardWidth(width);
      setBoardHeight(height);
    };
    update();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (observer && containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [computeDimensions]);

  const buildNodeNoop =
    (_id?: number) =>
    () =>
      undefined;
  const buildEdgeNoop =
    (_id?: [number, number]) =>
    () =>
      undefined;

  return (
    <div className="board-snapshot" ref={containerRef}>
      <div
        className="board-wrapper"
        style={{ width: boardWidth, height: boardHeight }}
      >
        <Board
          width={boardWidth}
          height={boardHeight + BOARD_VERTICAL_OFFSET}
          buildOnNodeClick={buildNodeNoop}
          buildOnEdgeClick={buildEdgeNoop}
          handleTileClick={() => undefined}
          nodeActions={{}}
          edgeActions={{}}
          replayMode={true}
          gameState={gameState}
          isMobile={false}
          show={true}
          isMovingRobber={false}
        />
      </div>
    </div>
  );
}
