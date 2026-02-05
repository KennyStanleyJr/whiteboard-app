import { useCallback, RefObject } from "react";
import { clampZoom, type WheelData, zoomAtPoint } from "./panZoomUtils";

export interface WheelZoomOptions {
  minZoom: number;
  maxZoom: number;
  zoomSensitivity: number;
}

export function useWheelZoomHandlers(
  containerRef: RefObject<HTMLElement | null>,
  stateRef: RefObject<{ panX: number; panY: number; zoom: number }>,
  setZoom: (z: number) => void,
  setPanX: (p: number | ((prev: number) => number)) => void,
  setPanY: (p: number | ((prev: number) => number)) => void,
  options: WheelZoomOptions
): { handleWheelRaw: (data: WheelData) => void; onWheel: (e: React.WheelEvent) => void } {
  const { minZoom, maxZoom, zoomSensitivity } = options;

  const handleWheelRaw = useCallback(
    (data: WheelData) => {
      const el = containerRef.current;
      if (!el || !stateRef.current) return;
      const rect = el.getBoundingClientRect();
      const cursorX = data.clientX - rect.left;
      const cursorY = data.clientY - rect.top;
      const { panX: px, panY: py, zoom: z } = stateRef.current;
      const delta = -data.deltaY * zoomSensitivity;
      const nextZoom = clampZoom(z * (1 + delta), minZoom, maxZoom);
      const { panX: nextPanX, panY: nextPanY } = zoomAtPoint(cursorX, cursorY, px, py, z, nextZoom);
      setZoom(nextZoom);
      setPanX(nextPanX);
      setPanY(nextPanY);
    },
    [containerRef, stateRef, minZoom, maxZoom, zoomSensitivity, setZoom, setPanX, setPanY]
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!containerRef.current) return;
      e.preventDefault();
      handleWheelRaw({ clientX: e.clientX, clientY: e.clientY, deltaY: e.deltaY });
    },
    [containerRef, handleWheelRaw]
  );

  return { handleWheelRaw, onWheel };
}
