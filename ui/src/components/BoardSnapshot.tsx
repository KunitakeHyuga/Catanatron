import { useEffect, useMemo, useRef, useState } from "react";
import Board from "../pages/Board";
import type { GameState } from "../utils/api.types";

import "./BoardSnapshot.scss";

type BoardSnapshotProps = {
  gameState: GameState;
};

export default function BoardSnapshot({ gameState }: BoardSnapshotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  const computeDimensions = useMemo(
    () =>
      (containerWidth: number) => {
        const width = Math.min(Math.max(containerWidth - 16, 320), 1000);
        const height = Math.min(Math.max(width * 0.9, 360), 860);
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
      setDimensions(computeDimensions(containerWidth));
    };
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
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
      <Board
        width={dimensions.width}
        height={dimensions.height}
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
        fitContainer={true}
      />
    </div>
  );
}
