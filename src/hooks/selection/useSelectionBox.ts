import { useCallback, useState, RefObject } from "react";

export interface Point {
  x: number;
  y: number;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Convert client coordinates to SVG viewBox coordinates.
 * Uses container rect and viewBox dimensions so the selection box aligns with the SVG.
 * Returns null if element is missing or any dimension is non-positive (avoids division by zero).
 */
function clientToViewBox(
  el: HTMLElement | null,
  clientX: number,
  clientY: number,
  viewBoxWidth: number,
  viewBoxHeight: number
): Point | null {
  if (!el || viewBoxWidth <= 0 || viewBoxHeight <= 0) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const scaleX = viewBoxWidth / rect.width;
  const scaleY = viewBoxHeight / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function toSelectionRect(
  start: Point | null,
  end: Point | null
): SelectionRect | null {
  if (start === null || end === null) return null;
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  if (width === 0 || height === 0) return null;
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width,
    height,
  };
}

export function useSelectionBox(
  containerRef: RefObject<HTMLElement | null>,
  viewBoxWidth: number,
  viewBoxHeight: number,
  onPointerDown: (e: React.PointerEvent) => void,
  onPointerMove: (e: React.PointerEvent) => void,
  onPointerUp: (e: React.PointerEvent) => void,
  onPointerLeave: (e: React.PointerEvent) => void
): {
  selectionRect: SelectionRect | null;
  handlePointerDown: (e: React.PointerEvent) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: (e: React.PointerEvent) => void;
  handlePointerLeave: (e: React.PointerEvent) => void;
} {
  const [selectionStart, setSelectionStart] = useState<Point | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Point | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0) {
        const p = clientToViewBox(
          containerRef.current,
          e.clientX,
          e.clientY,
          viewBoxWidth,
          viewBoxHeight
        );
        if (p) {
          setSelectionStart(p);
          setSelectionEnd(null);
        }
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }
      onPointerDown(e);
    },
    [containerRef, viewBoxWidth, viewBoxHeight, onPointerDown]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (selectionStart !== null && (e.buttons & 1) !== 0) {
        const p = clientToViewBox(
          containerRef.current,
          e.clientX,
          e.clientY,
          viewBoxWidth,
          viewBoxHeight
        );
        if (p) setSelectionEnd(p);
      }
      onPointerMove(e);
    },
    [containerRef, viewBoxWidth, viewBoxHeight, onPointerMove, selectionStart]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0) {
        setSelectionStart(null);
        setSelectionEnd(null);
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      }
      onPointerUp(e);
    },
    [onPointerUp]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if ((e.buttons & 1) === 0) {
        setSelectionStart(null);
        setSelectionEnd(null);
      }
      onPointerLeave(e);
    },
    [onPointerLeave]
  );

  const selectionRect = toSelectionRect(selectionStart, selectionEnd);

  return {
    selectionRect,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  };
}
