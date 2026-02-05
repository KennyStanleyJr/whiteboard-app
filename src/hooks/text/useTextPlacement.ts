import { useCallback, useRef, RefObject } from "react";
import { clientToViewBox } from "../canvas/canvasCoords";

const CLICK_MOVE_THRESHOLD_PX = 6;

export interface TextPlacementHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
}

export function useTextPlacement(
  containerRef: RefObject<HTMLElement | null>,
  viewBoxWidth: number,
  viewBoxHeight: number,
  panZoomHandlers: TextPlacementHandlers,
  onAddText: (x: number, y: number) => void,
  isBackgroundClick?: (e: React.PointerEvent) => boolean
): TextPlacementHandlers {
  const downRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0) {
        downRef.current = { x: e.clientX, y: e.clientY };
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }
      panZoomHandlers.onPointerDown(e);
    },
    [panZoomHandlers]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0) {
        const down = downRef.current;
        downRef.current = null;
        (e.target as Element).releasePointerCapture?.(e.pointerId);
        if (down) {
          const dx = e.clientX - down.x;
          const dy = e.clientY - down.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= CLICK_MOVE_THRESHOLD_PX) {
            const onBackground = isBackgroundClick ? isBackgroundClick(e) : true;
            if (onBackground) {
              const p = clientToViewBox(
                containerRef.current,
                e.clientX,
                e.clientY,
                viewBoxWidth,
                viewBoxHeight
              );
              if (p) onAddText(p.x, p.y);
            }
          }
        }
      }
      panZoomHandlers.onPointerUp(e);
    },
    [
      containerRef,
      viewBoxWidth,
      viewBoxHeight,
      onAddText,
      isBackgroundClick,
      panZoomHandlers,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      panZoomHandlers.onPointerMove(e);
    },
    [panZoomHandlers]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if ((e.buttons & 1) === 0) downRef.current = null;
      panZoomHandlers.onPointerLeave(e);
    },
    [panZoomHandlers]
  );

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerLeave: handlePointerLeave,
  };
}
