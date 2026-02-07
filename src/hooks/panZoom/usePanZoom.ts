import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MAX_ZOOM, MIN_ZOOM, type WheelData, ZOOM_SENSITIVITY } from "./panZoomUtils";
import { useRightButtonPanHandlers } from "./useRightButtonPanHandlers";
import { useTouchPanZoomHandlers } from "./useTouchPanZoomHandlers";
import { useWheelZoomHandlers } from "./useWheelZoomHandlers";
import { getWhiteboardSync, setWhiteboard, type WhiteboardState } from "@/api/whiteboard";
import { getWhiteboardQueryKey } from "@/hooks/useWhiteboard";
import { getCurrentBoardIdSync } from "@/api/boards";

export interface PanZoomState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface UsePanZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  zoomSensitivity?: number;
  boardId?: string;
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
  /** True when the last context menu should be suppressed (e.g. after right-drag pan). Caller clears after reading. */
  contextMenuSuppressedRef: React.MutableRefObject<boolean>;
}

function getInitialPanZoom(boardId?: string): PanZoomState {
  const stored = getWhiteboardSync(boardId);
  return stored.panZoom ?? { panX: 0, panY: 0, zoom: 1 };
}

type PanZoomUpdater = number | ((prev: number) => number);

export function usePanZoom(options: UsePanZoomOptions = {}): UsePanZoomReturn {
  const { minZoom = MIN_ZOOM, maxZoom = MAX_ZOOM, zoomSensitivity = ZOOM_SENSITIVITY, boardId } = options;
  const queryClient = useQueryClient();
  const currentBoardId = boardId ?? getCurrentBoardIdSync();
  const queryKey = useMemo(() => getWhiteboardQueryKey(currentBoardId), [currentBoardId]);
  let initialPanZoom: PanZoomState | null = null;
  const getInitial = (): PanZoomState => {
    if (initialPanZoom == null) {
      initialPanZoom = getInitialPanZoom(currentBoardId);
    }
    return initialPanZoom;
  };
  const [panZoom, setPanZoom] = useState<PanZoomState>(() => getInitial());

  const containerRef = useRef<HTMLElement | null>(null);
  const stateRef = useRef(panZoom);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactingRef = useRef(false);
  const lastBoardIdRef = useRef<string>(currentBoardId);
  const persistBoardIdRef = useRef<string>(currentBoardId);
  stateRef.current = panZoom;

  const setPanX = useCallback((value: PanZoomUpdater) => {
    setPanZoom((prev) => ({
      ...prev,
      panX: typeof value === "function" ? value(prev.panX) : value,
    }));
  }, []);
  const setPanY = useCallback((value: PanZoomUpdater) => {
    setPanZoom((prev) => ({
      ...prev,
      panY: typeof value === "function" ? value(prev.panY) : value,
    }));
  }, []);
  const setZoom = useCallback((z: number) => {
    setPanZoom((prev) => ({ ...prev, zoom: z }));
  }, []);

  const persistPanZoom = useCallback(() => {
    if (saveTimeoutRef.current != null) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const { panX: px, panY: py, zoom: z } = stateRef.current;
    const boardIdToPersist = persistBoardIdRef.current;
    const current = getWhiteboardSync(boardIdToPersist);
    const newState: WhiteboardState = {
      ...current,
      panZoom: { panX: px, panY: py, zoom: z },
    };
    const persistQueryKey = getWhiteboardQueryKey(boardIdToPersist);
    queryClient.setQueryData(persistQueryKey, newState);
    setWhiteboard(newState, boardIdToPersist).catch((err) => {
      console.error("[usePanZoom] persist failed", err);
    });
  }, [queryClient]);

  // Reset pan/zoom when boardId changes
  useEffect(() => {
    if (lastBoardIdRef.current !== currentBoardId) {
      // Cancel any pending persist operations for the old board
      if (saveTimeoutRef.current != null) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      // Persist the old board's panZoom before switching
      const oldBoardId = lastBoardIdRef.current;
      const oldPanZoom = stateRef.current;
      const oldState = getWhiteboardSync(oldBoardId);
      const oldStateToPersist: WhiteboardState = {
        ...oldState,
        panZoom: { panX: oldPanZoom.panX, panY: oldPanZoom.panY, zoom: oldPanZoom.zoom },
      };
      setWhiteboard(oldStateToPersist, oldBoardId).catch((err) => {
        console.error("[usePanZoom] persist old board failed", err);
      });
      
      lastBoardIdRef.current = currentBoardId;
      persistBoardIdRef.current = currentBoardId;
      setPanZoom(getInitialPanZoom(currentBoardId));
    }
  }, [currentBoardId]);

  useEffect(() => {
    if (interactingRef.current) return;
    if (lastBoardIdRef.current !== currentBoardId) {
      return;
    }
    if (saveTimeoutRef.current != null) {
      clearTimeout(saveTimeoutRef.current);
    }
    persistBoardIdRef.current = currentBoardId;
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      // Use the boardId from when the timeout was set up
      const boardIdToPersist = persistBoardIdRef.current;
      // Only persist if we're still on the same board
      if (boardIdToPersist === currentBoardId) {
        const current = getWhiteboardSync(boardIdToPersist);
        const { panX: px, panY: py, zoom: z } = stateRef.current;
        const newState: WhiteboardState = {
          ...current,
          panZoom: { panX: px, panY: py, zoom: z },
        };
        const persistQueryKey = getWhiteboardQueryKey(boardIdToPersist);
        queryClient.setQueryData(persistQueryKey, newState);
        setWhiteboard(newState, boardIdToPersist).catch((err) => {
          console.error("[usePanZoom] persist failed", err);
        });
      }
    }, 100);
    return () => {
      if (saveTimeoutRef.current != null) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [panZoom.panX, panZoom.panY, panZoom.zoom, queryClient, queryKey, currentBoardId]);

  useEffect(() => {
    return () => {
      // On unmount, persist using the boardId from when this effect was set up
      const boardIdToPersist = persistBoardIdRef.current;
      const { panX: px, panY: py, zoom: z } = stateRef.current;
      const current = getWhiteboardSync(boardIdToPersist);
      const newState: WhiteboardState = {
        ...current,
        panZoom: { panX: px, panY: py, zoom: z },
      };
      const persistQueryKey = getWhiteboardQueryKey(boardIdToPersist);
      queryClient.setQueryData(persistQueryKey, newState);
      setWhiteboard(newState, boardIdToPersist).catch((err) => {
        console.error("[usePanZoom] persist failed on unmount", err);
      });
    };
  }, [queryClient, queryKey, currentBoardId]);

  const wheelOpts = { minZoom, maxZoom, zoomSensitivity };
  const wheel = useWheelZoomHandlers(
    containerRef,
    stateRef,
    setZoom,
    setPanX,
    setPanY,
    wheelOpts
  );
  const contextMenuSuppressedRef = useRef(false);
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
    contextMenuSuppressedRef,
  });

  return {
    panX: panZoom.panX,
    panY: panZoom.panY,
    zoom: panZoom.zoom,
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
    contextMenuSuppressedRef,
  };
}
