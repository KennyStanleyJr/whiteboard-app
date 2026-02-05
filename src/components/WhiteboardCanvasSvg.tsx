import type { SelectionRect } from "../hooks/useSelectionBox";
import { DotGridPattern, PATTERN_ID } from "./DotGridPattern";

const CANVAS_EXTENT = 500000;

export interface WhiteboardCanvasSvgProps {
  panX: number;
  panY: number;
  zoom: number;
  width: number;
  height: number;
  selectionRect: SelectionRect | null;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  isPanning: boolean;
}

export function WhiteboardCanvasSvg(props: WhiteboardCanvasSvgProps): JSX.Element {
  const {
    panX,
    panY,
    zoom,
    width,
    height,
    selectionRect,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onContextMenu,
    isPanning,
  } = props;

  const transform = `translate(${panX}, ${panY}) scale(${zoom})`;
  const viewBox = `0 0 ${width} ${height}`;

  return (
    <svg
      className="whiteboard-canvas"
      viewBox={viewBox}
      preserveAspectRatio="none"
    >
      <defs>
        <DotGridPattern />
      </defs>
      <g
        transform={transform}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onContextMenu={onContextMenu}
        style={{ cursor: isPanning ? "grabbing" : "default" }}
      >
        <rect
          x={-CANVAS_EXTENT}
          y={-CANVAS_EXTENT}
          width={CANVAS_EXTENT * 2}
          height={CANVAS_EXTENT * 2}
          fill={`url(#${PATTERN_ID})`}
        />
      </g>
      {selectionRect !== null && (
        <rect
          className="selection-box"
          x={selectionRect.x}
          y={selectionRect.y}
          width={selectionRect.width}
          height={selectionRect.height}
          fill="rgba(0, 120, 215, 0.1)"
          stroke="rgba(0, 120, 215, 0.8)"
          strokeWidth={1.5}
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
