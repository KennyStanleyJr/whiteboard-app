import type { WhiteboardElement } from "@/types/whiteboard";
import {
  getElementBounds,
  sanitizeElementBounds,
  type ElementBounds,
} from "@/utils/elementBounds";
import { safeSvgNumber } from "@/utils/safeSvgNumber";
import {
  RESIZE_HANDLE_CURSORS,
  RESIZE_HANDLE_IDS,
  type ResizeHandleId,
} from "@/utils/resizeHandles";

const SELECTION_BOX_PADDING_PX = 4;
/** Bar length (along the edge) in pixels; kept constant on screen via zoom. */
const BAR_LENGTH_PX = 20;
/** Bar thickness in pixels; kept constant on screen via zoom. */
const BAR_THICKNESS_PX = 6;

export interface ElementSelectionOverlayProps {
  selectedElementIds: string[];
  elements: WhiteboardElement[];
  measuredBounds: Record<string, ElementBounds>;
  /** Current zoom; used so selection stroke and handle size stay constant on screen. */
  zoom: number;
  onResizeHandleDown?: (handleId: ResizeHandleId, e: React.PointerEvent) => void;
  onResizeHandleMove?: (e: React.PointerEvent) => void;
  onResizeHandleUp?: (e: React.PointerEvent) => void;
}

interface BarStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

function renderCornerHandle(
  handleId: "nw" | "ne" | "se" | "sw",
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  lengthW: number,
  thickW: number,
  style: BarStyle,
  cursor: string,
  onPointerDown: (e: React.PointerEvent) => void,
  onPointerMove: (e: React.PointerEvent) => void,
  onPointerUp: (e: React.PointerEvent) => void,
  onPointerLeave: (e: React.PointerEvent) => void
): JSX.Element {
  const ht = thickW / 2;
  const pathProps = {
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeLinejoin: "round" as const,
    vectorEffect: "non-scaling-stroke" as const,
  };
  const groupProps = {
    className: "resize-handle",
    style: { cursor },
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
  };
  // Two bar-style arms: horizontal -ht..cornerLength × -ht..ht, vertical -ht..ht × -ht..cornerLength.
  // Bars fully overlap in square (-ht,-ht) to (ht,ht) for clean join.
  // Overlap center (0,0) at selection box corner so handle straddles outline (half in, half out).
  const cornerLength = lengthW * 0.6;
  // Trace union outline: outer horizontal -> shared corner -> outer vertical -> close
  const canonicalD = `M ${cornerLength} ${ht} L ${cornerLength} ${-ht} L ${-ht} ${-ht} L ${-ht} ${cornerLength} L ${ht} ${cornerLength} L ${ht} ${ht} Z`;
  // Position overlap center (0,0) at selection box corner, accounting for scale transform
  const tx =
    handleId === "nw" || handleId === "sw"
      ? sx
      : sx + sw;
  const ty =
    handleId === "nw" || handleId === "ne"
      ? sy
      : sy + sh;
  const scaleX = handleId === "ne" || handleId === "se" ? -1 : 1;
  const scaleY = handleId === "sw" || handleId === "se" ? -1 : 1;
  const transform =
    scaleX === 1 && scaleY === 1
      ? `translate(${safeSvgNumber(tx, 0)}, ${safeSvgNumber(ty, 0)})`
      : `translate(${safeSvgNumber(tx, 0)}, ${safeSvgNumber(ty, 0)}) scale(${scaleX}, ${scaleY})`;
  return (
    <g key={handleId} {...groupProps} transform={transform}>
      <path d={canonicalD} {...pathProps} />
    </g>
  );
}

function renderEdgeHandle(
  x: number,
  y: number,
  width: number,
  height: number,
  handleId: ResizeHandleId,
  rectProps: {
    fill: string;
    stroke: string;
    strokeWidth: number;
    vectorEffect: "non-scaling-stroke";
  },
  groupProps: {
    className: string;
    style: { cursor: string };
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerLeave: (e: React.PointerEvent) => void;
  }
): JSX.Element {
  return (
    <g key={handleId} {...groupProps}>
      <rect
        x={safeSvgNumber(x, 0)}
        y={safeSvgNumber(y, 0)}
        width={safeSvgNumber(width, 1)}
        height={safeSvgNumber(height, 1)}
        {...rectProps}
      />
    </g>
  );
}

function renderHandleBar(
  handleId: ResizeHandleId,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  lengthW: number,
  thickW: number,
  style: BarStyle,
  cursor: string,
  onPointerDown: (e: React.PointerEvent) => void,
  onPointerMove: (e: React.PointerEvent) => void,
  onPointerUp: (e: React.PointerEvent) => void,
  onPointerLeave: (e: React.PointerEvent) => void
): JSX.Element {
  const hl = lengthW / 2;
  const ht = thickW / 2;
  const rectProps = {
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    vectorEffect: "non-scaling-stroke" as const,
  };
  const groupProps = {
    className: "resize-handle",
    style: { cursor },
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
  };

  switch (handleId) {
    case "n": {
      const x = sx + sw / 2 - hl;
      const y = sy - ht;
      return renderEdgeHandle(x, y, lengthW, thickW, handleId, rectProps, groupProps);
    }
    case "s": {
      const x = sx + sw / 2 - hl;
      const y = sy + sh - ht;
      return renderEdgeHandle(x, y, lengthW, thickW, handleId, rectProps, groupProps);
    }
    case "e": {
      const x = sx + sw - ht;
      const y = sy + sh / 2 - hl;
      return renderEdgeHandle(x, y, thickW, lengthW, handleId, rectProps, groupProps);
    }
    case "w": {
      const x = sx - ht;
      const y = sy + sh / 2 - hl;
      return renderEdgeHandle(x, y, thickW, lengthW, handleId, rectProps, groupProps);
    }
    case "nw":
    case "ne":
    case "se":
    case "sw":
      return renderCornerHandle(
        handleId,
        sx,
        sy,
        sw,
        sh,
        lengthW,
        thickW,
        style,
        cursor,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerLeave
      );
  }
}

export function ElementSelectionOverlay({
  selectedElementIds,
  elements,
  measuredBounds,
  zoom,
  onResizeHandleDown,
  onResizeHandleMove,
  onResizeHandleUp,
}: ElementSelectionOverlayProps): JSX.Element {
  const zoomSafe = Math.max(zoom, 0.001);
  const paddingWorld = SELECTION_BOX_PADDING_PX / zoomSafe;
  const barLengthWorld = BAR_LENGTH_PX / zoomSafe;
  const barThicknessWorld = BAR_THICKNESS_PX / zoomSafe;
  const showHandles =
    selectedElementIds.length === 1 &&
    onResizeHandleDown != null &&
    onResizeHandleMove != null &&
    onResizeHandleUp != null;

  const nodes = selectedElementIds.map((id): JSX.Element | null => {
    const el = elements.find((e) => e.id === id);
    if (el == null) return null;
    const hasExplicitSize =
      (el.kind === "text" &&
        el.width != null &&
        el.height != null &&
        el.width > 0 &&
        el.height > 0) ||
      (el.kind === "shape" &&
        el.width > 0 &&
        el.height > 0);
    const rawBounds = hasExplicitSize
      ? getElementBounds(el, measuredBounds)
      : measuredBounds[id] ?? getElementBounds(el, measuredBounds);
    const b = sanitizeElementBounds(rawBounds);
    const sx = safeSvgNumber(b.x - paddingWorld, 0);
    const sy = safeSvgNumber(b.y - paddingWorld, 0);
    const sw = safeSvgNumber(
      Math.max(1, b.width + 2 * paddingWorld),
      1
    );
    const sh = safeSvgNumber(
      Math.max(1, b.height + 2 * paddingWorld),
      1
    );

    return (
      <g key={`selection-${id}`}>
        <rect
          className="element-selection-box"
          x={sx}
          y={sy}
          width={sw}
          height={sh}
          fill="none"
          stroke="rgba(0, 120, 215, 0.8)"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        {showHandles &&
          selectedElementIds[0] === id &&
          RESIZE_HANDLE_IDS.map((handleId) =>
            renderHandleBar(
              handleId,
              sx,
              sy,
              sw,
              sh,
              barLengthWorld,
              barThicknessWorld,
              {
                fill: "white",
                stroke: "rgba(0, 120, 215, 0.8)",
                strokeWidth: 1.5,
              },
              RESIZE_HANDLE_CURSORS[handleId],
              (e) => {
                e.stopPropagation();
                onResizeHandleDown?.(handleId, e);
                (e.target as Element).setPointerCapture?.(e.pointerId);
              },
              onResizeHandleMove ?? (() => {}),
              (e) => {
                onResizeHandleUp?.(e);
                (e.target as Element).releasePointerCapture?.(e.pointerId);
              },
              (e) => {
                if ((e.buttons & 1) === 0)
                  (e.target as Element).releasePointerCapture?.(e.pointerId);
              }
            )
          )}
      </g>
    );
  });

  return <>{nodes}</>;
}
