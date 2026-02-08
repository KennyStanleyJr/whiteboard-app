import { useCallback, useReducer, useRef } from "react";

export interface UseRightButtonPanHandlersOptions {
  onPanEnd?: () => void;
  interactingRef?: React.MutableRefObject<boolean>;
  /** Set to true when context menu should be suppressed (e.g. after panning). Caller clears after reading. */
  contextMenuSuppressedRef?: React.MutableRefObject<boolean>;
}

/** State machine: right-drag pan. Idle until button 2 down, then panning until button up/leave. */
type PanningState = "idle" | "panning";

type PanningAction = { type: "START" } | { type: "STOP" };

function panningReducer(state: PanningState, action: PanningAction): PanningState {
  switch (action.type) {
    case "START":
      return "panning";
    case "STOP":
      return "idle";
    default:
      return state;
  }
}

export function useRightButtonPanHandlers(
  setPanX: (p: number | ((prev: number) => number)) => void,
  setPanY: (p: number | ((prev: number) => number)) => void,
  options: UseRightButtonPanHandlersOptions = {}
): {
  isPanning: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
} {
  const { onPanEnd, interactingRef, contextMenuSuppressedRef } = options;
  const [panningState, dispatch] = useReducer(panningReducer, "idle");
  const isPanningRef = useRef(false);
  const hasMovedRef = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const stopPanning = useCallback(() => {
    const wasPanning = isPanningRef.current;
    const didMove = hasMovedRef.current;
    isPanningRef.current = false;
    hasMovedRef.current = false;
    if (wasPanning && didMove && contextMenuSuppressedRef) {
      contextMenuSuppressedRef.current = true;
    }
    if (interactingRef) interactingRef.current = false;
    dispatch({ type: "STOP" });
    if (wasPanning) onPanEnd?.();
  }, [onPanEnd, interactingRef, contextMenuSuppressedRef]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (hasMovedRef.current || contextMenuSuppressedRef?.current) {
        e.preventDefault();
        if (contextMenuSuppressedRef) contextMenuSuppressedRef.current = true;
      }
    },
    [contextMenuSuppressedRef]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 2) return;
      isPanningRef.current = true;
      dispatch({ type: "START" });
      if (interactingRef) interactingRef.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [interactingRef]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setPanX((p) => p + dx);
    setPanY((p) => p + dy);
    hasMovedRef.current = true;
  }, [setPanX, setPanY]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.button !== 2) return;
    stopPanning();
    if (e.buttons === 0) {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    }
  }, [stopPanning]);

  const onPointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons === 0) stopPanning();
    },
    [stopPanning]
  );

  return {
    isPanning: panningState === "panning",
    onContextMenu,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
  };
}
