import { useCallback, useState } from "react";
import type { WhiteboardElement } from "@/types/whiteboard";

/**
 * Maximum number of history entries to keep in memory.
 * Bounded to prevent unbounded growth (NASA Power of 10).
 */
const MAX_HISTORY_SIZE = 50;

interface HistoryState {
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

/**
 * Hook for managing undo/redo functionality for whiteboard elements.
 * Maintains a bounded history stack of element states.
 *
 * @param initialElements - Initial elements array
 * @returns Object with elements, setElements wrapper, undo, redo, and state flags
 */
export function useUndoRedo(
  initialElements: WhiteboardElement[]
): {
  elements: WhiteboardElement[];
  setElements: (
    action: React.SetStateAction<WhiteboardElement[]>,
    options?: SetElementsOptions
  ) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
} {
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: initialElements,
    future: [],
  }));

  /**
   * Truncate array to max size, keeping most recent entries.
   */
  const truncateHistory = useCallback(
    (arr: WhiteboardElement[][]): WhiteboardElement[][] => {
      if (arr.length <= MAX_HISTORY_SIZE) return arr;
      return arr.slice(-MAX_HISTORY_SIZE);
    },
    []
  );

  /**
   * Create a deep copy of elements array for history.
   */
  const copyElements = useCallback(
    (elements: WhiteboardElement[]): WhiteboardElement[] => {
      return elements.map((el) => ({ ...el }));
    },
    []
  );

  /**
   * Check if two element arrays are equal (shallow comparison by id and properties).
   */
  const areElementsEqual = useCallback(
    (a: WhiteboardElement[], b: WhiteboardElement[]): boolean => {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i += 1) {
        const elA = a[i];
        const elB = b[i];
        if (elA == null || elB == null) return false;
        if (elA.id !== elB.id) return false;
        if (JSON.stringify(elA) !== JSON.stringify(elB)) return false;
      }
      return true;
    },
    []
  );

  const setElements = useCallback(
    (
      action: React.SetStateAction<WhiteboardElement[]>,
      options?: SetElementsOptions
    ) => {
      const skipHistory = options?.skipHistory === true;
      const pushToPast = options?.pushToPast === true;

      setHistory((prev) => {
        const current = prev.present;
        const next =
          typeof action === "function" ? action(current) : action;

        if (pushToPast) {
          const pastCopy = [...prev.past, copyElements(current)];
          // Clear redo history when starting a new action (e.g., drag) after undo
          // This ensures that if you undo and then start a new action, you can't redo
          // the old timeline that was diverged from
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

        // Clear redo history when making a new change (standard undo/redo behavior:
        // diverging from timeline by making a new change loses ability to redo)
        return {
          past: truncateHistory(pastCopy),
          present: nextCopy,
          future: [],
        };
      });
    },
    [areElementsEqual, copyElements, truncateHistory]
  );

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;

      const previous = prev.past[prev.past.length - 1];
      if (previous == null) return prev;
      
      const newPast = prev.past.slice(0, -1);
      const newFuture = [copyElements(prev.present), ...prev.future];

      return {
        past: newPast,
        present: previous,
        future: truncateHistory(newFuture),
      };
    });
  }, [copyElements, truncateHistory]);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;

      const next = prev.future[0];
      if (next == null) return prev;
      
      const newFuture = prev.future.slice(1);
      const newPast = [...prev.past, copyElements(prev.present)];

      return {
        past: truncateHistory(newPast),
        present: next,
        future: newFuture,
      };
    });
  }, [copyElements, truncateHistory]);

  return {
    elements: history.present,
    setElements,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
