import { useCallback, useReducer, useRef, RefObject } from "react";
import { clientToViewBox } from "../canvas/canvasCoords";

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

/**
 * State machine: marquee selection. Idle (start/end null) or drawing (start set, end updates on move).
 * RESET clears on pointer up/leave or when multi-touch is detected.
 */
interface SelectionBoxState {
  start: Point | null;
  end: Point | null;
}

type SelectionBoxAction =
  | { type: "START"; payload: Point }
  | { type: "MOVE_END"; payload: Point }
  | { type: "RESET" };

const INITIAL_SELECTION: SelectionBoxState = { start: null, end: null };

function selectionBoxReducer(
  state: SelectionBoxState,
  action: SelectionBoxAction
): SelectionBoxState {
  switch (action.type) {
    case "START":
      return { start: action.payload, end: null };
    case "MOVE_END":
      return state.start !== null
        ? { ...state, end: action.payload }
        : state;
    case "RESET":
      return INITIAL_SELECTION;
    default:
      return state;
  }
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
  const [state, dispatch] = useReducer(
    selectionBoxReducer,
    INITIAL_SELECTION
  );
  const activeTouchPointersRef = useRef<Set<number>>(new Set());

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch") {
        activeTouchPointersRef.current.add(e.pointerId);
        const isMultiTouch = activeTouchPointersRef.current.size >= 2;
        if (isMultiTouch) dispatch({ type: "RESET" });
      }
      if (e.button === 0) {
        const isMultiTouch = activeTouchPointersRef.current.size >= 2;
        if (!isMultiTouch) {
          const p = clientToViewBox(
            containerRef.current,
            e.clientX,
            e.clientY,
            viewBoxWidth,
            viewBoxHeight
          );
          if (p) {
            dispatch({ type: "START", payload: p });
          }
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }
      }
      onPointerDown(e);
    },
    [containerRef, viewBoxWidth, viewBoxHeight, onPointerDown]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const isMultiTouch = activeTouchPointersRef.current.size >= 2;
      if (isMultiTouch && state.start !== null) {
        dispatch({ type: "RESET" });
      } else if (state.start !== null && (e.buttons & 1) !== 0) {
        const p = clientToViewBox(
          containerRef.current,
          e.clientX,
          e.clientY,
          viewBoxWidth,
          viewBoxHeight
        );
        if (p) dispatch({ type: "MOVE_END", payload: p });
      }
      onPointerMove(e);
    },
    [containerRef, viewBoxWidth, viewBoxHeight, onPointerMove, state.start]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch") {
        activeTouchPointersRef.current.delete(e.pointerId);
      }
      if (e.button === 0) {
        dispatch({ type: "RESET" });
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      }
      onPointerUp(e);
    },
    [onPointerUp]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch") {
        activeTouchPointersRef.current.delete(e.pointerId);
      }
      if ((e.buttons & 1) === 0) {
        dispatch({ type: "RESET" });
      }
      onPointerLeave(e);
    },
    [onPointerLeave]
  );

  const selectionRect = toSelectionRect(state.start, state.end);

  return {
    selectionRect,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  };
}
