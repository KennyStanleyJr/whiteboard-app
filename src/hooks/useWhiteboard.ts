import type { SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { WhiteboardElement } from "@/types/whiteboard";
import {
  getWhiteboard,
  getWhiteboardSync,
  setWhiteboard,
  type WhiteboardState,
} from "@/api/whiteboard";

export const WHITEBOARD_QUERY_KEY = ["whiteboard"] as const;

export function useWhiteboardQuery(): {
  elements: WhiteboardElement[];
  setElements: (action: SetStateAction<WhiteboardElement[]>) => void;
  isPending: boolean;
} {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: WHITEBOARD_QUERY_KEY,
    queryFn: getWhiteboard,
    initialData: getWhiteboardSync,
  });

  const elements = data?.elements ?? [];

  const setElements = (action: SetStateAction<WhiteboardElement[]>): void => {
    const current = queryClient.getQueryData<WhiteboardState>(WHITEBOARD_QUERY_KEY);
    const currentElements = current?.elements ?? [];
    const next =
      typeof action === "function" ? action(currentElements) : action;
    const newState: WhiteboardState = {
      elements: next,
      panZoom: current?.panZoom,
    };
    queryClient.setQueryData(WHITEBOARD_QUERY_KEY, newState);
    /* Explicit failure handling: do not swallow persist errors (SWE-061). */
    setWhiteboard(newState).catch((err) => {
      console.error("[useWhiteboard] persist failed", err);
    });
  };

  return { elements, setElements, isPending };
}
