import { useCallback, useEffect, useMemo, useRef, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { WhiteboardElement } from "@/types/whiteboard";
import {
  getWhiteboard,
  getWhiteboardSync,
  setWhiteboard,
  type WhiteboardState,
} from "@/api/whiteboard";
import type { GridStyle } from "@/lib/canvasPreferences";
import { useUndoRedo } from "./useUndoRedo";
import type { HistoryState, SetElementsOptions } from "./useUndoRedo";
import { getCurrentBoardIdSync } from "@/api/boards";

export function getWhiteboardQueryKey(boardId: string): readonly [string, string] {
  return ["whiteboard", boardId] as const;
}

const DEFAULT_BACKGROUND_COLOR = "#ffffff";
const DEFAULT_GRID_STYLE: GridStyle = "dotted";
const PERSIST_DEBOUNCE_MS = 250;

/** Per-board undo history; survives unmount so switching boards keeps each board's undo stack. */
const boardHistoryStore = new Map<
  string,
  { past: WhiteboardElement[][]; future: WhiteboardElement[][] }
>();

/** Clears per-board history store. For tests. */
export function clearBoardHistoryStore(): void {
  boardHistoryStore.clear();
}

export function useWhiteboardQuery(boardId?: string): {
  elements: WhiteboardElement[];
  setElements: (
    action: SetStateAction<WhiteboardElement[]>,
    options?: SetElementsOptions
  ) => void;
  persistNow: () => void;
  isPending: boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  backgroundColor: string;
  gridStyle: GridStyle;
} {
  const queryClient = useQueryClient();
  const currentBoardId = boardId ?? getCurrentBoardIdSync();
  const queryKey = useMemo(() => getWhiteboardQueryKey(currentBoardId), [currentBoardId]);
  const { data, isPending } = useQuery({
    queryKey,
    queryFn: () => getWhiteboard(currentBoardId),
    initialData: () => getWhiteboardSync(currentBoardId),
  });

  const initialElements = data?.elements ?? [];
  const onHistoryChange = useCallback(
    (state: HistoryState) => {
      boardHistoryStore.set(currentBoardId, {
        past: state.past,
        future: state.future,
      });
    },
    [currentBoardId]
  );
  const undoRedo = useUndoRedo(initialElements, { onHistoryChange });
  const lastSyncedRef = useRef<string>(JSON.stringify(initialElements));
  const pendingElementsRef = useRef<WhiteboardElement[]>(undoRedo.elements);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipPersistRef = useRef(false);
  const isExternalUpdateRef = useRef(false);
  const lastBoardIdRef = useRef<string>(currentBoardId);
  const persistBoardIdRef = useRef<string>(currentBoardId);
  const cacheJustWrittenByUsRef = useRef(false);

  useEffect(() => {
    const saved = boardHistoryStore.get(currentBoardId);
    if (saved?.past.length === 0 && saved?.future.length === 0) return;
    if (saved == null) return;
    const present = data?.elements ?? [];
    undoRedo.replaceState({ past: saved.past, present, future: saved.future });
    lastSyncedRef.current = JSON.stringify(present);
    pendingElementsRef.current = present;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount to restore this board's history
  }, []);

  // Sync to query cache immediately when undo/redo state changes (run before sync-from-query so cache is fresh)
  useEffect(() => {
    if (isExternalUpdateRef.current) {
      isExternalUpdateRef.current = false;
      return;
    }
    // Do not write to cache when board has changed: undo state may still be the previous board's.
    if (lastBoardIdRef.current !== currentBoardId) {
      if (persistTimeoutRef.current != null) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
      return;
    }
    pendingElementsRef.current = undoRedo.elements;
    const undoRedoStr = JSON.stringify(undoRedo.elements);
    const lastSyncedStr = lastSyncedRef.current;
    if (undoRedoStr !== lastSyncedStr) {
      const current = queryClient.getQueryData<WhiteboardState>(queryKey);
      const newState: WhiteboardState = {
        elements: undoRedo.elements,
        panZoom: current?.panZoom,
        backgroundColor: current?.backgroundColor,
        gridStyle: current?.gridStyle,
      };
      queryClient.setQueryData(queryKey, newState);
      lastSyncedRef.current = undoRedoStr;
      cacheJustWrittenByUsRef.current = true;
      if (skipPersistRef.current) {
        skipPersistRef.current = false;
        if (persistTimeoutRef.current != null) {
          clearTimeout(persistTimeoutRef.current);
          persistTimeoutRef.current = null;
        }
        return;
      }
      if (persistTimeoutRef.current != null) {
        clearTimeout(persistTimeoutRef.current);
      }
      persistBoardIdRef.current = currentBoardId;
      persistTimeoutRef.current = setTimeout(() => {
        persistTimeoutRef.current = null;
        skipPersistRef.current = false;
        const boardIdToPersist = persistBoardIdRef.current;
        if (boardIdToPersist === currentBoardId) {
          const toPersist = pendingElementsRef.current;
          lastSyncedRef.current = JSON.stringify(toPersist);
          const persistQueryKey = getWhiteboardQueryKey(boardIdToPersist);
          const currentPersist = queryClient.getQueryData<WhiteboardState>(persistQueryKey);
          const state: WhiteboardState = {
            elements: toPersist,
            panZoom: currentPersist?.panZoom,
            backgroundColor: currentPersist?.backgroundColor,
            gridStyle: currentPersist?.gridStyle,
          };
          setWhiteboard(state, boardIdToPersist).catch((err) => {
            console.error("[useWhiteboard] persist failed", err);
          });
        }
      }, PERSIST_DEBOUNCE_MS);
    }
    return () => {
      if (persistTimeoutRef.current != null) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
    };
  }, [undoRedo.elements, queryClient, queryKey, currentBoardId]);

  // Sync undo/redo state when query data changes externally (e.g., from upload)
  useEffect(() => {
    if (cacheJustWrittenByUsRef.current) {
      cacheJustWrittenByUsRef.current = false;
      return;
    }
    if (lastBoardIdRef.current !== currentBoardId) {
      return;
    }
    const queryElements = data?.elements ?? [];
    const queryElementsStr = JSON.stringify(queryElements);
    const currentElementsStr = JSON.stringify(undoRedo.elements);
    if (
      queryElementsStr !== lastSyncedRef.current &&
      queryElementsStr !== currentElementsStr &&
      !isExternalUpdateRef.current
    ) {
      isExternalUpdateRef.current = true;
      undoRedo.setElements(queryElements);
      lastSyncedRef.current = queryElementsStr;
      pendingElementsRef.current = queryElements;
      if (persistTimeoutRef.current != null) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- We intentionally only depend on specific properties to avoid infinite loops
  }, [currentBoardId, data?.elements, undoRedo.elements, undoRedo.setElements]);

  // Reset undo/redo state when boardId changes
  useEffect(() => {
    if (lastBoardIdRef.current !== currentBoardId) {
      // Cancel any pending persist operations for the old board
      if (persistTimeoutRef.current != null) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
      // Persist the old board's state before switching (if there are pending changes)
      const oldBoardId = lastBoardIdRef.current;
      const oldQueryKey = getWhiteboardQueryKey(oldBoardId);
      const oldPendingElements = pendingElementsRef.current;
      const oldState = queryClient.getQueryData<WhiteboardState>(oldQueryKey);
      if (oldState != null) {
        const oldStateToPersist: WhiteboardState = {
          elements: oldPendingElements,
          panZoom: oldState.panZoom,
          backgroundColor: oldState.backgroundColor,
          gridStyle: oldState.gridStyle,
        };
        // Only persist if elements actually changed
        const oldStateStr = JSON.stringify(oldState.elements);
        const oldPendingStr = JSON.stringify(oldPendingElements);
        if (oldStateStr !== oldPendingStr) {
          setWhiteboard(oldStateToPersist, oldBoardId).catch((err) => {
            console.error("[useWhiteboard] persist old board failed", err);
          });
        }
      }

      lastBoardIdRef.current = currentBoardId;
      persistBoardIdRef.current = currentBoardId;
      const queryElements = data?.elements ?? [];
      isExternalUpdateRef.current = true;

      // Restore the new board's undo/redo history from store if we have it
      const saved = boardHistoryStore.get(currentBoardId);
      if (
        saved != null &&
        (saved.past.length > 0 || saved.future.length > 0)
      ) {
        undoRedo.replaceState({
          past: saved.past,
          present: queryElements,
          future: saved.future,
        });
      } else {
        undoRedo.setElements(queryElements);
      }

      lastSyncedRef.current = JSON.stringify(queryElements);
      pendingElementsRef.current = queryElements;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- undoRedo identity can change; we only need setElements and board/query deps
  }, [currentBoardId, data?.elements, undoRedo.setElements, undoRedo.replaceState, queryClient]);

  const persistNow = useCallback(() => {
    skipPersistRef.current = false;
    if (persistTimeoutRef.current != null) {
      clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = null;
    }
    const toPersist = pendingElementsRef.current;
    const boardIdToPersist = persistBoardIdRef.current;
    const persistQueryKey = getWhiteboardQueryKey(boardIdToPersist);
    const current = queryClient.getQueryData<WhiteboardState>(persistQueryKey);
    const state: WhiteboardState = {
      elements: toPersist,
      panZoom: current?.panZoom,
      backgroundColor: current?.backgroundColor,
      gridStyle: current?.gridStyle,
    };
    lastSyncedRef.current = JSON.stringify(toPersist);
    setWhiteboard(state, boardIdToPersist).catch((err) => {
      console.error("[useWhiteboard] persist failed", err);
    });
  }, [queryClient]);

  const flushPendingPersist = useCallback(() => {
    persistNow();
  }, [persistNow]);

  // Cleanup: persist on unmount, but only if we're still on the same board
  useEffect(() => {
    const boardIdAtMount = persistBoardIdRef.current;
    return () => {
      // Only persist if we're still on the same board as when this effect was set up
      if (boardIdAtMount === persistBoardIdRef.current) {
        flushPendingPersist();
      }
    };
  }, [flushPendingPersist]);

  const setElements = (
    action: SetStateAction<WhiteboardElement[]>,
    options?: SetElementsOptions
  ): void => {
    if (options?.skipHistory === true) {
      skipPersistRef.current = true;
    }
    undoRedo.setElements(action, options);
  };

  const backgroundColor =
    data?.backgroundColor != null && /^#[0-9A-Fa-f]{6}$/.test(data.backgroundColor)
      ? data.backgroundColor
      : DEFAULT_BACKGROUND_COLOR;
  const gridStyle =
    data?.gridStyle === "empty" ||
    data?.gridStyle === "dotted" ||
    data?.gridStyle === "lined" ||
    data?.gridStyle === "grid-lined"
      ? data.gridStyle
      : DEFAULT_GRID_STYLE;

  return {
    elements: undoRedo.elements,
    setElements,
    persistNow,
    isPending,
    undo: undoRedo.undo,
    redo: undoRedo.redo,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
    backgroundColor,
    gridStyle,
  };
}
