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

const SELECTION_BOX_PADDING = 4;
const RESIZE_HANDLE_SIZE = 8;

export interface ElementSelectionOverlayProps {
  selectedElementIds: string[];
  elements: WhiteboardElement[];
  measuredBounds: Record<string, ElementBounds>;
  onResizeHandleDown?: (handleId: ResizeHandleId, e: React.PointerEvent) => void;
  onResizeHandleMove?: (e: React.PointerEvent) => void;
  onResizeHandleUp?: (e: React.PointerEvent) => void;
}

function getHandlePosition(
  handleId: ResizeHandleId,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  hs: number
): { x: number; y: number } {
  switch (handleId) {
    case "nw":
      return { x: sx - hs, y: sy - hs };
    case "n":
      return { x: sx + sw / 2 - hs, y: sy - hs };
    case "ne":
      return { x: sx + sw - hs, y: sy - hs };
    case "e":
      return { x: sx + sw - hs, y: sy + sh / 2 - hs };
    case "se":
      return { x: sx + sw - hs, y: sy + sh - hs };
    case "s":
      return { x: sx + sw / 2 - hs, y: sy + sh - hs };
    case "sw":
      return { x: sx - hs, y: sy + sh - hs };
    case "w":
      return { x: sx - hs, y: sy + sh / 2 - hs };
  }
}

export function ElementSelectionOverlay({
  selectedElementIds,
  elements,
  measuredBounds,
  onResizeHandleDown,
  onResizeHandleMove,
  onResizeHandleUp,
}: ElementSelectionOverlayProps): JSX.Element {
  const hs = RESIZE_HANDLE_SIZE / 2;
  const showHandles =
    selectedElementIds.length === 1 &&
    onResizeHandleDown != null &&
    onResizeHandleMove != null &&
    onResizeHandleUp != null;

  const nodes = selectedElementIds.map((id): JSX.Element | null => {
    const el = elements.find((e) => e.id === id);
    if (el == null) return null;
    const hasExplicitSize =
      el.kind === "text" &&
      el.width != null &&
      el.height != null &&
      el.width > 0 &&
      el.height > 0;
    const rawBounds = hasExplicitSize
      ? getElementBounds(el, measuredBounds)
      : measuredBounds[id] ?? getElementBounds(el, measuredBounds);
    const b = sanitizeElementBounds(rawBounds);
    const sx = safeSvgNumber(b.x - SELECTION_BOX_PADDING, 0);
    const sy = safeSvgNumber(b.y - SELECTION_BOX_PADDING, 0);
    const sw = safeSvgNumber(
      Math.max(1, b.width + 2 * SELECTION_BOX_PADDING),
      1
    );
    const sh = safeSvgNumber(
      Math.max(1, b.height + 2 * SELECTION_BOX_PADDING),
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
          pointerEvents="none"
        />
        {showHandles &&
          selectedElementIds[0] === id &&
          RESIZE_HANDLE_IDS.map((handleId) => {
            const { x: hx, y: hy } = getHandlePosition(
              handleId,
              sx,
              sy,
              sw,
              sh,
              hs
            );
            return (
              <rect
                key={handleId}
                className="resize-handle"
                x={safeSvgNumber(hx, 0)}
                y={safeSvgNumber(hy, 0)}
                width={safeSvgNumber(RESIZE_HANDLE_SIZE, 8)}
                height={safeSvgNumber(RESIZE_HANDLE_SIZE, 8)}
                fill="white"
                stroke="rgba(0, 120, 215, 0.8)"
                strokeWidth={1.5}
                style={{ cursor: RESIZE_HANDLE_CURSORS[handleId] }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onResizeHandleDown?.(handleId, e);
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                }}
                onPointerMove={onResizeHandleMove}
                onPointerUp={(e) => {
                  onResizeHandleUp?.(e);
                  (e.target as Element).releasePointerCapture?.(e.pointerId);
                }}
                onPointerLeave={(e) => {
                  if ((e.buttons & 1) === 0)
                    (e.target as Element).releasePointerCapture?.(e.pointerId);
                }}
              />
            );
          })}
      </g>
    );
  });

  return <>{nodes}</>;
}
