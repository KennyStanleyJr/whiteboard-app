import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MAX_ZOOM, MIN_ZOOM, type WheelData, ZOOM_SENSITIVITY } from "./panZoomUtils";
import { useRightButtonPanHandlers } from "./useRightButtonPanHandlers";
import { useTouchPanZoomHandlers } from "./useTouchPanZoomHandlers";
import { useWheelZoomHandlers } from "./useWheelZoomHandlers";
import { getWhiteboardSync, setWhiteboard, type WhiteboardState } from "@/api/whiteboard";
import { WHITEBOARD_QUERY_KEY } from "@/hooks/useWhiteboard";

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

function getInitialPanZoom(): PanZoomState {
  const stored = getWhiteboardSync();
  return stored.panZoom ?? { panX: 0, panY: 0, zoom: 1 };
}

export function usePanZoom(options: UsePanZoomOptions = {}): UsePanZoomReturn {
  const { minZoom = MIN_ZOOM, maxZoom = MAX_ZOOM, zoomSensitivity = ZOOM_SENSITIVITY } = options;
  const queryClient = useQueryClient();
  let initialPanZoom: PanZoomState | null = null;
  const getInitial = (): PanZoomState => {
    if (initialPanZoom == null) {
      initialPanZoom = getInitialPanZoom();
    }
    return initialPanZoom;
  };
  const [panX, setPanX] = useState(() => getInitial().panX);
  const [panY, setPanY] = useState(() => getInitial().panY);
  const [zoom, setZoom] = useState(() => getInitial().zoom);

  const containerRef = useRef<HTMLElement | null>(null);
  const stateRef = useRef({ panX: 0, panY: 0, zoom: 1 });
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactingRef = useRef(false);
  stateRef.current = { panX, panY, zoom };

  const persistPanZoom = useCallback(() => {
    if (saveTimeoutRef.current != null) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const { panX: px, panY: py, zoom: z } = stateRef.current;
    const current = getWhiteboardSync();
    const newState: WhiteboardState = {
      ...current,
      panZoom: { panX: px, panY: py, zoom: z },
    };
    queryClient.setQueryData(WHITEBOARD_QUERY_KEY, newState);
    setWhiteboard(newState).catch((err) => {
      console.error("[usePanZoom] persist failed", err);
    });
  }, [queryClient]);

  useEffect(() => {
    if (interactingRef.current) return;
    if (saveTimeoutRef.current != null) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      const current = getWhiteboardSync();
      const newState: WhiteboardState = {
        ...current,
        panZoom: { panX, panY, zoom },
      };
      queryClient.setQueryData(WHITEBOARD_QUERY_KEY, newState);
      setWhiteboard(newState).catch((err) => {
        console.error("[usePanZoom] persist failed", err);
      });
    }, 100);
    return () => {
      if (saveTimeoutRef.current != null) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [panX, panY, zoom, queryClient]);

  useEffect(() => {
    return () => {
      const { panX: px, panY: py, zoom: z } = stateRef.current;
      const current = getWhiteboardSync();
      const newState: WhiteboardState = {
        ...current,
        panZoom: { panX: px, panY: py, zoom: z },
      };
      queryClient.setQueryData(WHITEBOARD_QUERY_KEY, newState);
      setWhiteboard(newState).catch((err) => {
        console.error("[usePanZoom] persist failed on unmount", err);
      });
    };
  }, [queryClient]);

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
    { minZoom, maxZoom, onGestureEnd: persistPanZoom, interactingRef }
  );
  const pointer = useRightButtonPanHandlers(setPanX, setPanY, {
    onPanEnd: persistPanZoom,
    interactingRef,
  });

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
