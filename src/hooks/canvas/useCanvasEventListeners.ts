import { useEffect, RefObject } from "react";
import type { WheelData } from "../panZoom/panZoomUtils";

export function useCanvasEventListeners(
  containerRef: RefObject<HTMLElement | null>,
  handleWheelRaw: (data: WheelData) => void,
  handleTouchStart: (e: TouchEvent) => void,
  handleTouchMove: (e: TouchEvent) => void,
  handleTouchEnd: (e: TouchEvent) => void
): void {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      handleWheelRaw({ clientX: e.clientX, clientY: e.clientY, deltaY: e.deltaY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [containerRef, handleWheelRaw]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);
}
