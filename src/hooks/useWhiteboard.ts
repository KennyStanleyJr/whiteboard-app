import { useCallback, useEffect, useRef, type SetStateAction } from "react";
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

export const WHITEBOARD_QUERY_KEY = ["whiteboard"] as const;

import type { SetElementsOptions } from "./useUndoRedo";

export function useWhiteboardQuery(): {
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
  const { data, isPending } = useQuery({
    queryKey: WHITEBOARD_QUERY_KEY,
    queryFn: getWhiteboard,
    initialData: getWhiteboardSync,
  });

  const initialElements = data?.elements ?? [];
  const undoRedo = useUndoRedo(initialElements);
  const lastSyncedRef = useRef<string>(JSON.stringify(initialElements));
  const pendingElementsRef = useRef<WhiteboardElement[]>(undoRedo.elements);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipPersistRef = useRef(false);
  const isExternalUpdateRef = useRef(false);

  const PERSIST_DEBOUNCE_MS = 250;

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
    const current = queryClient.getQueryData<WhiteboardState>(WHITEBOARD_QUERY_KEY);
    const state: WhiteboardState = {
      elements: toPersist,
      panZoom: current?.panZoom,
    };
    lastSyncedRef.current = JSON.stringify(toPersist);
    setWhiteboard(state).catch((err) => {
      console.error("[useWhiteboard] persist failed", err);
    });
  }, [queryClient]);

  const flushPendingPersist = useCallback(() => {
    persistNow();
  }, [persistNow]);

  useEffect(() => {
    return () => {
      flushPendingPersist();
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
      const current = queryClient.getQueryData<WhiteboardState>(WHITEBOARD_QUERY_KEY);
      const newState: WhiteboardState = {
        elements: undoRedo.elements,
        panZoom: current?.panZoom,
      };
      queryClient.setQueryData(WHITEBOARD_QUERY_KEY, newState);
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
      persistTimeoutRef.current = setTimeout(() => {
        persistTimeoutRef.current = null;
        skipPersistRef.current = false;
        const toPersist = pendingElementsRef.current;
        lastSyncedRef.current = JSON.stringify(toPersist);
        const state: WhiteboardState = {
          elements: toPersist,
          panZoom: queryClient.getQueryData<WhiteboardState>(WHITEBOARD_QUERY_KEY)?.panZoom,
        };
        setWhiteboard(state).catch((err) => {
          console.error("[useWhiteboard] persist failed", err);
        });
      }, PERSIST_DEBOUNCE_MS);
    }

    return () => {
      if (persistTimeoutRef.current != null) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
    };
  }, [undoRedo.elements, queryClient]);

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
