import { useEffect, useRef, type SetStateAction } from "react";
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

  // Sync undo/redo changes to query cache and persistence
  useEffect(() => {
    const undoRedoStr = JSON.stringify(undoRedo.elements);
    const lastSyncedStr = lastSyncedRef.current;

    // Only sync if elements actually changed
    if (undoRedoStr !== lastSyncedStr) {
      lastSyncedRef.current = undoRedoStr;
      const current = queryClient.getQueryData<WhiteboardState>(WHITEBOARD_QUERY_KEY);
      const newState: WhiteboardState = {
        elements: undoRedo.elements,
        panZoom: current?.panZoom,
      };
      queryClient.setQueryData(WHITEBOARD_QUERY_KEY, newState);
      /* Explicit failure handling: do not swallow persist errors (SWE-061). */
      setWhiteboard(newState).catch((err) => {
        console.error("[useWhiteboard] persist failed", err);
      });
    }
  }, [undoRedo.elements, queryClient]);

  const setElements = (
    action: SetStateAction<WhiteboardElement[]>,
    options?: SetElementsOptions
  ): void => {
    undoRedo.setElements(action, options);
  };

  return {
    elements: undoRedo.elements,
    setElements,
    isPending,
    undo: undoRedo.undo,
    redo: undoRedo.redo,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
  };
}
