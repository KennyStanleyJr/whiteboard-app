import { useCallback, useEffect, useReducer } from "react";
import type { WhiteboardElement } from "@/types/whiteboard";

/**
 * Maximum number of history entries to keep in memory.
 * Bounded to prevent unbounded growth (NASA Power of 10).
 */
const MAX_HISTORY_SIZE = 50;

export interface HistoryState {
  past: WhiteboardElement[][];
  present: WhiteboardElement[];
  future: WhiteboardElement[][];
}

export interface SetElementsOptions {
  /** Update present without pushing current to past (e.g. during drag). */
  skipHistory?: boolean;
  /** Push current state to past without changing present (e.g. at drag start). */
  pushToPast?: boolean;
}

export interface UseUndoRedoOptions {
  /** Called whenever history changes (e.g. to persist per-board history). */
  onHistoryChange?: (state: HistoryState) => void;
}

function truncateHistory(
  arr: WhiteboardElement[][]
): WhiteboardElement[][] {
  if (arr.length <= MAX_HISTORY_SIZE) return arr;
  return arr.slice(-MAX_HISTORY_SIZE);
}

function copyElements(elements: WhiteboardElement[]): WhiteboardElement[] {
  return elements.map((el) => ({ ...el }));
}

function areElementsEqual(
  a: WhiteboardElement[],
  b: WhiteboardElement[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const elA = a[i];
    const elB = b[i];
    if (elA == null || elB == null) return false;
    if (elA.id !== elB.id) return false;
    if (JSON.stringify(elA) !== JSON.stringify(elB)) return false;
  }
  return true;
}

/** Reducer: history stack (past, present, future). SET_ELEMENTS handles skipHistory/pushToPast for drags. */
type HistoryAction =
  | {
      type: "SET_ELEMENTS";
      payload: {
        action: React.SetStateAction<WhiteboardElement[]>;
        options?: SetElementsOptions;
      };
    }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "REPLACE_STATE"; payload: HistoryState };

function historyReducer(
  prev: HistoryState,
  action: HistoryAction
): HistoryState {
  switch (action.type) {
    case "SET_ELEMENTS": {
      const { action: setStateAction, options } = action.payload;
      const current = prev.present;
      const next =
        typeof setStateAction === "function"
          ? setStateAction(current)
          : setStateAction;
      const skipHistory = options?.skipHistory === true;
      const pushToPast = options?.pushToPast === true;

      if (pushToPast) {
        const pastCopy = [...prev.past, copyElements(current)];
        return {
          past: truncateHistory(pastCopy),
          present: prev.present,
          future: [],
        };
      }
      if (skipHistory) {
        if (areElementsEqual(current, next)) return prev;
        return {
          past: prev.past,
          present: copyElements(next),
          future: prev.future,
        };
      }
      if (areElementsEqual(current, next)) return prev;
      const nextCopy = copyElements(next);
      const pastCopy = [...prev.past, copyElements(current)];
      return {
        past: truncateHistory(pastCopy),
        present: nextCopy,
        future: [],
      };
    }
    case "UNDO": {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      if (previous == null) return prev;
      return {
        past: prev.past.slice(0, -1),
        present: previous,
        future: truncateHistory([
          copyElements(prev.present),
          ...prev.future,
        ]),
      };
    }
    case "REDO": {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      if (next == null) return prev;
      return {
        past: truncateHistory([...prev.past, copyElements(prev.present)]),
        present: next,
        future: prev.future.slice(1),
      };
    }
    case "REPLACE_STATE": {
      const state = action.payload;
      return {
        past: truncateHistory(state.past),
        present: copyElements(state.present),
        future: state.future.slice(),
      };
    }
    default:
      return prev;
  }
}

/**
 * Hook for managing undo/redo functionality for whiteboard elements.
 * Maintains a bounded history stack of element states.
 *
 * @param initialElements - Initial elements array
 * @param options - Optional onHistoryChange callback
 * @returns Object with elements, setElements wrapper, undo, redo, replaceState, and state flags
 */
export function useUndoRedo(
  initialElements: WhiteboardElement[],
  options?: UseUndoRedoOptions
): {
  elements: WhiteboardElement[];
  setElements: (
    action: React.SetStateAction<WhiteboardElement[]>,
    options?: SetElementsOptions
  ) => void;
  undo: () => void;
  redo: () => void;
  replaceState: (state: HistoryState) => void;
  canUndo: boolean;
  canRedo: boolean;
} {
  const { onHistoryChange } = options ?? {};
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialElements,
    future: [],
  });

  useEffect(() => {
    if (history.past.length === 0 && history.future.length === 0) return;
    onHistoryChange?.(history);
  }, [history, onHistoryChange]);

  const setElements = useCallback(
    (
      action: React.SetStateAction<WhiteboardElement[]>,
      setOptions?: SetElementsOptions
    ) => {
      dispatch({ type: "SET_ELEMENTS", payload: { action, options: setOptions } });
    },
    []
  );

  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  const replaceState = useCallback((state: HistoryState) => {
    dispatch({ type: "REPLACE_STATE", payload: state });
  }, []);

  return {
    elements: history.present,
    setElements,
    undo,
    redo,
    replaceState,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
