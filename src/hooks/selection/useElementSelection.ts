import { useCallback, useEffect, useReducer, useRef, RefObject, MutableRefObject } from "react";
import { clientToWorld } from "../canvas/canvasCoords";
import {
  elementAtPoint,
  elementsInRect,
  type ElementBounds,
} from "../../lib/elementBounds";
import type { WhiteboardElement } from "../../types/whiteboard";
import type { SelectionRect } from "./useSelectionBox";
import type { SetElementsOptions } from "../useUndoRedo";

export interface ElementSelectionHandlers {
  handlePointerDown: (e: React.PointerEvent) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: (e: React.PointerEvent) => void;
  handlePointerLeave: (e: React.PointerEvent) => void;
}

interface DragState {
  startWorld: { x: number; y: number };
  /** id -> { x, y } at drag start */
  startPositions: Map<string, { x: number; y: number }>;
  /** Original selection before click - used to restore if dragging */
  originalSelection: string[];
  /** Element ID to select on mouse up if no drag occurred */
  clickElementId: string | null;
  /** Whether movement occurred (drag vs click) */
  hasMoved: boolean;
  /** Whether we have pushed pre-drag state to undo history (once per drag) */
  historyPushed: boolean;
}

function viewBoxRectToWorld(
  rect: SelectionRect,
  panX: number,
  panY: number,
  zoom: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: (rect.x - panX) / zoom,
    y: (rect.y - panY) / zoom,
    width: rect.width / zoom,
    height: rect.height / zoom,
  };
}

/**
 * Reducer: selection (selectedIds) and drag flag (isDragging).
 * Drag details live in a ref; reducer only tracks which ids are selected and whether a drag is in progress.
 */
interface SelectionState {
  selectedIds: string[];
  isDragging: boolean;
}

type SelectionAction =
  | { type: "SET_IDS"; payload: React.SetStateAction<string[]> }
  | { type: "DRAG_START" }
  | { type: "DRAG_END" };

function selectionReducer(
  state: SelectionState,
  action: SelectionAction
): SelectionState {
  switch (action.type) {
    case "SET_IDS": {
      const payload = action.payload;
      const next =
        typeof payload === "function" ? payload(state.selectedIds) : payload;
      return { ...state, selectedIds: next };
    }
    case "DRAG_START":
      return { ...state, isDragging: true };
    case "DRAG_END":
      return { ...state, isDragging: false };
    default:
      return state;
  }
}

export function useElementSelection(
  containerRef: RefObject<HTMLElement | null>,
  viewBoxWidth: number,
  viewBoxHeight: number,
  panX: number,
  panY: number,
  zoom: number,
  elements: WhiteboardElement[],
  setElements: (
    action: React.SetStateAction<WhiteboardElement[]>,
    options?: SetElementsOptions
  ) => void,
  selectionRect: SelectionRect | null,
  measuredBounds: Record<string, ElementBounds>,
  selectionHandlers: ElementSelectionHandlers,
  panZoomHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerLeave: (e: React.PointerEvent) => void;
  },
  editingElementId: string | null,
  onDragEnd?: () => void,
  toolbarContainerRef?: RefObject<HTMLElement | null>,
  touchPanningRef?: MutableRefObject<boolean>
): {
  selectedElementIds: string[];
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  isDragging: boolean;
  handlers: ElementSelectionHandlers;
} {
  const [state, dispatch] = useReducer(selectionReducer, {
    selectedIds: [],
    isDragging: false,
  });
  const { selectedIds: selectedElementIds, isDragging } = state;
  const dragStateRef = useRef<DragState | null>(null);
  const marqueeModifiersRef = useRef<{ shiftKey: boolean; ctrlKey: boolean }>({
    shiftKey: false,
    ctrlKey: false,
  });
  const activeTouchPointersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const ids = new Set(elements.map((el) => el.id));
    dispatch({
      type: "SET_IDS",
      payload: (prev) => prev.filter((id) => ids.has(id)),
    });
  }, [elements]);

  const setSelectedElementIds = useCallback(
    (action: React.SetStateAction<string[]>) => {
      dispatch({ type: "SET_IDS", payload: action });
    },
    []
  );

  const applyDragMove = useCallback(
    (dx: number, dy: number) => {
      const drag = dragStateRef.current;
      if (drag == null) return;
      setElements(
        (prev) =>
          prev.map((el) => {
            const start = drag.startPositions.get(el.id);
            if (start === undefined) return el;
            return {
              ...el,
              x: start.x + dx,
              y: start.y + dy,
            };
          }),
        { skipHistory: true }
      );
    },
    [setElements]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch") {
        activeTouchPointersRef.current.add(e.pointerId);
      }
      const isMultiTouch = activeTouchPointersRef.current.size >= 2;
      const isTouchPanning = touchPanningRef?.current === true;
      if (isMultiTouch || isTouchPanning) {
        if (dragStateRef.current !== null) {
          dragStateRef.current = null;
          dispatch({ type: "DRAG_END" });
        }
        selectionHandlers.handlePointerDown(e);
        return;
      }
      if (e.button !== 0) {
        selectionHandlers.handlePointerDown(e);
        return;
      }
      if (toolbarContainerRef?.current?.contains(e.target as Node)) {
        return;
      }
      const world = clientToWorld(
        containerRef.current,
        e.clientX,
        e.clientY,
        viewBoxWidth,
        viewBoxHeight,
        panX,
        panY,
        zoom
      );
      if (world === null) {
        dispatch({ type: "SET_IDS", payload: [] });
        selectionHandlers.handlePointerDown(e);
        return;
      }
      const hit = elementAtPoint(world.x, world.y, elements, measuredBounds);
      if (hit !== null) {
        const isSelected = selectedElementIds.includes(hit.id);
        let idsToMove: string[];
        let idsToSelect: string[];
        let clickElementId: string | null = null;
        if (e.shiftKey) {
          if (isSelected) {
            idsToMove = selectedElementIds.filter((id) => id !== hit.id);
            idsToSelect = idsToMove;
          } else {
            idsToMove = [...selectedElementIds, hit.id];
            idsToSelect = idsToMove;
          }
        } else {
          if (isSelected && selectedElementIds.length > 1) {
            idsToSelect = selectedElementIds;
            idsToMove = selectedElementIds;
            clickElementId = hit.id;
          } else {
            idsToSelect = [hit.id];
            idsToMove = [hit.id];
          }
        }
        dispatch({ type: "SET_IDS", payload: idsToSelect });
        if (hit.id === editingElementId) {
          return;
        }
        const startPositions = new Map<string, { x: number; y: number }>();
        for (const id of idsToMove) {
          const el = elements.find((x) => x.id === id);
          if (el) startPositions.set(id, { x: el.x, y: el.y });
        }
        dragStateRef.current = {
          startWorld: { x: world.x, y: world.y },
          startPositions,
          originalSelection: selectedElementIds,
          clickElementId,
          hasMoved: false,
          historyPushed: false,
        };
        dispatch({ type: "DRAG_START" });
        (e.target as Element).setPointerCapture?.(e.pointerId);
        panZoomHandlers.onPointerDown(e);
      } else {
        if (!e.shiftKey && !(e.ctrlKey || e.metaKey)) {
          dispatch({ type: "SET_IDS", payload: [] });
        }
        marqueeModifiersRef.current = {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey || e.metaKey,
        };
        dragStateRef.current = null;
        selectionHandlers.handlePointerDown(e);
      }
    },
    [
      containerRef,
      viewBoxWidth,
      viewBoxHeight,
      panX,
      panY,
      zoom,
      elements,
      measuredBounds,
      selectedElementIds,
      editingElementId,
      selectionHandlers,
      panZoomHandlers,
      toolbarContainerRef,
      touchPanningRef,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const isMultiTouch = activeTouchPointersRef.current.size >= 2;
      const isTouchPanning = touchPanningRef?.current === true;
      if (isMultiTouch || isTouchPanning) {
        if (dragStateRef.current !== null) {
          dragStateRef.current = null;
          dispatch({ type: "DRAG_END" });
        }
        selectionHandlers.handlePointerMove(e);
        return;
      }
      const drag = dragStateRef.current;
      if (drag !== null && (e.buttons & 1) !== 0) {
        const world = clientToWorld(
          containerRef.current,
          e.clientX,
          e.clientY,
          viewBoxWidth,
          viewBoxHeight,
          panX,
          panY,
          zoom
        );
        if (world !== null) {
          const dx = world.x - drag.startWorld.x;
          const dy = world.y - drag.startWorld.y;
          const moved = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
          if (moved) {
            if (!drag.historyPushed) {
              setElements((prev) => prev, { pushToPast: true });
              drag.historyPushed = true;
            }
            drag.hasMoved = true;
            applyDragMove(dx, dy);
          }
        }
        panZoomHandlers.onPointerMove(e);
        return;
      }
      if (drag === null && (e.buttons & 1) !== 0) {
        marqueeModifiersRef.current = {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey || e.metaKey,
        };
      }
      selectionHandlers.handlePointerMove(e);
    },
    [
      containerRef,
      viewBoxWidth,
      viewBoxHeight,
      panX,
      panY,
      zoom,
      setElements,
      applyDragMove,
      selectionHandlers,
      panZoomHandlers,
      touchPanningRef,
    ]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch") {
        activeTouchPointersRef.current.delete(e.pointerId);
      }
      if (e.button === 0) {
        if (dragStateRef.current !== null) {
          const drag = dragStateRef.current;
          if (!drag.hasMoved && drag.clickElementId !== null) {
            setSelectedElementIds([drag.clickElementId]);
          }
          const hadMoved = drag.hasMoved;
          dragStateRef.current = null;
          dispatch({ type: "DRAG_END" });
          (e.target as Element).releasePointerCapture?.(e.pointerId);
          if (hadMoved) onDragEnd?.();
        } else if (selectionRect !== null) {
          const worldRect = viewBoxRectToWorld(selectionRect, panX, panY, zoom);
          const ids = elementsInRect(worldRect, elements, measuredBounds);
          const modifiers = marqueeModifiersRef.current;
          if (modifiers.ctrlKey) {
            setSelectedElementIds((prev) => {
              const idsSet = new Set(ids);
              return prev.filter((id) => !idsSet.has(id));
            });
          } else if (modifiers.shiftKey) {
            setSelectedElementIds((prev) => {
              const combined = new Set([...prev, ...ids]);
              return Array.from(combined);
            });
          } else {
            setSelectedElementIds(ids);
          }
          marqueeModifiersRef.current = { shiftKey: false, ctrlKey: false };
        }
        panZoomHandlers.onPointerUp(e);
        selectionHandlers.handlePointerUp(e);
      } else {
        selectionHandlers.handlePointerUp(e);
      }
    },
    [
      panX,
      panY,
      zoom,
      elements,
      measuredBounds,
      selectionRect,
      onDragEnd,
      panZoomHandlers,
      selectionHandlers,
      setSelectedElementIds,
    ]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "touch") {
        activeTouchPointersRef.current.delete(e.pointerId);
      }
      if ((e.buttons & 1) === 0) {
        if (dragStateRef.current !== null) dispatch({ type: "DRAG_END" });
        dragStateRef.current = null;
      }
      selectionHandlers.handlePointerLeave(e);
    },
    [selectionHandlers]
  );

  return {
    selectedElementIds,
    setSelectedElementIds,
    isDragging,
    handlers: {
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handlePointerLeave,
    },
  };
}
