import { useCallback, useRef, RefObject } from "react";
import {
  applyTouchPinch,
  createTouchGestureState,
  isTwoFingerTap,
  TAP_MAX_MOVE_PX,
  TAP_MAX_SCALE_CHANGE,
  touchCenterAndDistance,
  type TouchGestureState,
} from "./panZoomUtils";

export interface TouchPanZoomOptions {
  minZoom: number;
  maxZoom: number;
  onGestureEnd?: () => void;
  interactingRef?: React.MutableRefObject<boolean>;
}

export function useTouchPanZoomHandlers(
  containerRef: RefObject<HTMLElement | null>,
  stateRef: RefObject<{ panX: number; panY: number; zoom: number }>,
  setZoom: (z: number) => void,
  setPanX: (p: number) => void,
  setPanY: (p: number) => void,
  options: TouchPanZoomOptions
): {
  handleTouchStart: (e: TouchEvent) => void;
  handleTouchMove: (e: TouchEvent) => void;
  handleTouchEnd: (e: TouchEvent) => void;
} {
  const { minZoom, maxZoom, onGestureEnd, interactingRef } = options;
  const touchGestureRef = useRef<TouchGestureState | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        touchGestureRef.current = null;
        return;
      }
      if (interactingRef) interactingRef.current = true;
      const { cx, cy, dist } = touchCenterAndDistance(e.touches);
      const state = stateRef.current;
      if (!state) return;
      touchGestureRef.current = createTouchGestureState(
        cx,
        cy,
        dist,
        state.panX,
        state.panY,
        state.zoom
      );
    },
    [stateRef, interactingRef]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      const g = touchGestureRef.current;
      if (e.touches.length !== 2 || g === null) return;
      e.preventDefault();
      const { cx, cy, dist } = touchCenterAndDistance(e.touches);
      const movePx = Math.hypot(cx - g.centerX, cy - g.centerY);
      const scaleChange = Math.abs(dist / g.distance - 1);
      if (movePx > TAP_MAX_MOVE_PX || scaleChange > TAP_MAX_SCALE_CHANGE) g.movedEnough = true;
      const { nextZoom, nextPanX, nextPanY } = applyTouchPinch(g, cx, cy, dist, minZoom, maxZoom);
      setZoom(nextZoom);
      setPanX(nextPanX);
      setPanY(nextPanY);
    },
    [minZoom, maxZoom, setZoom, setPanX, setPanY]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      const g = touchGestureRef.current;
      if (g === null) return;
      if (e.touches.length >= 2) return;
      if (e.touches.length === 0) {
        if (interactingRef) interactingRef.current = false;
        if (isTwoFingerTap(g, Date.now() - g.startTime)) {
          containerRef.current?.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              clientX: g.centerX,
              clientY: g.centerY,
              button: 2,
            })
          );
        }
        touchGestureRef.current = null;
        onGestureEnd?.();
      }
    },
    [containerRef, interactingRef, onGestureEnd]
  );

  return { handleTouchStart, handleTouchMove, handleTouchEnd };
}
