import { useRef, useState } from "react";
import { MAX_ZOOM, MIN_ZOOM, type WheelData, ZOOM_SENSITIVITY } from "./panZoomUtils";
import { useRightButtonPanHandlers } from "./useRightButtonPanHandlers";
import { useTouchPanZoomHandlers } from "./useTouchPanZoomHandlers";
import { useWheelZoomHandlers } from "./useWheelZoomHandlers";

export interface PanZoomState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface UsePanZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  zoomSensitivity?: number;
}

export type { WheelData } from "./panZoomUtils";

export interface UsePanZoomReturn extends PanZoomState {
  isPanning: boolean;
  onWheel: (e: React.WheelEvent) => void;
  handleWheelRaw: (data: WheelData) => void;
  handleTouchStart: (e: TouchEvent) => void;
  handleTouchMove: (e: TouchEvent) => void;
  handleTouchEnd: (e: TouchEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  containerRef: React.RefObject<HTMLElement | null>;
}

export function usePanZoom(options: UsePanZoomOptions = {}): UsePanZoomReturn {
  const { minZoom = MIN_ZOOM, maxZoom = MAX_ZOOM, zoomSensitivity = ZOOM_SENSITIVITY } = options;
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);

  const containerRef = useRef<HTMLElement | null>(null);
  const stateRef = useRef({ panX: 0, panY: 0, zoom: 1 });
  stateRef.current = { panX, panY, zoom };

  const wheelOpts = { minZoom, maxZoom, zoomSensitivity };
  const wheel = useWheelZoomHandlers(
    containerRef,
    stateRef,
    setZoom,
    setPanX,
    setPanY,
    wheelOpts
  );
  const touch = useTouchPanZoomHandlers(
    containerRef,
    stateRef,
    setZoom,
    setPanX,
    setPanY,
    { minZoom, maxZoom }
  );
  const pointer = useRightButtonPanHandlers(setPanX, setPanY);

  return {
    panX,
    panY,
    zoom,
    isPanning: pointer.isPanning,
    onWheel: wheel.onWheel,
    handleWheelRaw: wheel.handleWheelRaw,
    handleTouchStart: touch.handleTouchStart,
    handleTouchMove: touch.handleTouchMove,
    handleTouchEnd: touch.handleTouchEnd,
    onContextMenu: pointer.onContextMenu,
    onPointerDown: pointer.onPointerDown,
    onPointerMove: pointer.onPointerMove,
    onPointerUp: pointer.onPointerUp,
    onPointerLeave: pointer.onPointerLeave,
    containerRef,
  };
}
