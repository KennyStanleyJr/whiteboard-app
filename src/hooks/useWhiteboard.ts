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
import { useUndoRedo } from "./useUndoRedo";
import { getCurrentBoardIdSync } from "@/api/boards";

export function getWhiteboardQueryKey(boardId: string): readonly [string, string] {
  return ["whiteboard", boardId] as const;
}

import type { SetElementsOptions } from "./useUndoRedo";

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
  const undoRedo = useUndoRedo(initialElements);
  const lastSyncedRef = useRef<string>(JSON.stringify(initialElements));
  const pendingElementsRef = useRef<WhiteboardElement[]>(undoRedo.elements);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipPersistRef = useRef(false);
  const isExternalUpdateRef = useRef(false);
  const lastBoardIdRef = useRef<string>(currentBoardId);
  const persistBoardIdRef = useRef<string>(currentBoardId);

  const PERSIST_DEBOUNCE_MS = 250;

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
      undoRedo.setElements(queryElements);
      lastSyncedRef.current = JSON.stringify(queryElements);
      pendingElementsRef.current = queryElements;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- undoRedo identity can change; we only need setElements and board/query deps
  }, [currentBoardId, data?.elements, undoRedo.setElements, queryClient]);

  // Sync undo/redo state when query data changes externally (e.g., from import)
  useEffect(() => {
    const queryElements = data?.elements ?? [];
    const queryElementsStr = JSON.stringify(queryElements);
    const currentElementsStr = JSON.stringify(undoRedo.elements);

    // If query data changed and doesn't match current undo/redo state, reset it
    // Only sync if this is an external change (not from our own setElements)
    if (
      queryElementsStr !== lastSyncedRef.current &&
      queryElementsStr !== currentElementsStr &&
      !isExternalUpdateRef.current
    ) {
      isExternalUpdateRef.current = true;
      undoRedo.setElements(queryElements);
      lastSyncedRef.current = queryElementsStr;
      pendingElementsRef.current = queryElements;
      // Clear any pending persist since this is an external update
      if (persistTimeoutRef.current != null) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- We intentionally only depend on specific properties to avoid infinite loops
  }, [data?.elements, undoRedo.elements, undoRedo.setElements]);

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

  // Sync to query cache immediately; debounce localStorage persist (skip during drag/resize)
  useEffect(() => {
    // Skip sync if this update came from external source (we already synced above)
    if (isExternalUpdateRef.current) {
      isExternalUpdateRef.current = false;
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
      };
      queryClient.setQueryData(queryKey, newState);
      // Update lastSyncedRef immediately to prevent external sync from triggering
      lastSyncedRef.current = undoRedoStr;

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
      // Store the boardId when setting up the timeout to ensure we persist to the correct board
      persistBoardIdRef.current = currentBoardId;
      persistTimeoutRef.current = setTimeout(() => {
        persistTimeoutRef.current = null;
        skipPersistRef.current = false;
        // Use the boardId from when the timeout was set up, not the current one
        const boardIdToPersist = persistBoardIdRef.current;
        // Only persist if we're still on the same board
        if (boardIdToPersist === currentBoardId) {
          const toPersist = pendingElementsRef.current;
          lastSyncedRef.current = JSON.stringify(toPersist);
          const persistQueryKey = getWhiteboardQueryKey(boardIdToPersist);
          const state: WhiteboardState = {
            elements: toPersist,
            panZoom: queryClient.getQueryData<WhiteboardState>(persistQueryKey)?.panZoom,
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

  const setElements = (
    action: SetStateAction<WhiteboardElement[]>,
    options?: SetElementsOptions
  ): void => {
    if (options?.skipHistory === true) {
      skipPersistRef.current = true;
    }
    undoRedo.setElements(action, options);
  };

  return {
    elements: undoRedo.elements,
    setElements,
    persistNow,
    isPending,
    undo: undoRedo.undo,
    redo: undoRedo.redo,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
  };
}
