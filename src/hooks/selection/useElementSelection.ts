import { useCallback, useEffect, useRef, useState, RefObject } from "react";
import { clientToWorld } from "../canvas/canvasCoords";
import {
  elementAtPoint,
  elementsInRect,
  type ElementBounds,
} from "../../utils/elementBounds";
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
  onDragEnd?: () => void
): {
  selectedElementIds: string[];
  setSelectedElementIds: React.Dispatch<React.SetStateAction<string[]>>;
  isDragging: boolean;
  handlers: ElementSelectionHandlers;
} {
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const marqueeModifiersRef = useRef<{ shiftKey: boolean; ctrlKey: boolean }>({
    shiftKey: false,
    ctrlKey: false,
  });
  const dragMovePendingRef = useRef<{ dx: number; dy: number } | null>(null);
  const dragRafRef = useRef<number | null>(null);

  useEffect(() => {
    const ids = new Set(elements.map((el) => el.id));
    setSelectedElementIds((prev) => prev.filter((id) => ids.has(id)));
  }, [elements]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) {
        selectionHandlers.handlePointerDown(e);
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
        setSelectedElementIds([]);
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
        setSelectedElementIds(idsToSelect);
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
        setIsDragging(true);
        (e.target as Element).setPointerCapture?.(e.pointerId);
        panZoomHandlers.onPointerDown(e);
      } else {
        if (!e.shiftKey && !(e.ctrlKey || e.metaKey)) {
          setSelectedElementIds([]);
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
    ]
  );

  const flushDragMove = useCallback(() => {
    const pending = dragMovePendingRef.current;
    if (pending == null) return;
    const drag = dragStateRef.current;
    if (drag == null) return;
    dragMovePendingRef.current = null;
    setElements(
      (prev) =>
        prev.map((el) => {
          const start = drag.startPositions.get(el.id);
          if (start === undefined) return el;
          return {
            ...el,
            x: start.x + pending.dx,
            y: start.y + pending.dy,
          };
        }),
      { skipHistory: true }
    );
  }, [setElements]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
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
          }
          dragMovePendingRef.current = { dx, dy };
          if (dragRafRef.current == null) {
            dragRafRef.current = requestAnimationFrame(() => {
              dragRafRef.current = null;
              flushDragMove();
            });
          }
        }
        panZoomHandlers.onPointerMove(e);
        return;
      }
      // Update modifier keys when selection box is active
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
      flushDragMove,
      selectionHandlers,
      panZoomHandlers,
    ]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0) {
        if (dragStateRef.current !== null) {
          const drag = dragStateRef.current;
          if (!drag.hasMoved && drag.clickElementId !== null) {
            setSelectedElementIds([drag.clickElementId]);
          }
          const hadMoved = drag.hasMoved;
          if (dragRafRef.current != null) {
            cancelAnimationFrame(dragRafRef.current);
            dragRafRef.current = null;
          }
          flushDragMove();
          dragStateRef.current = null;
          setIsDragging(false);
          (e.target as Element).releasePointerCapture?.(e.pointerId);
          if (hadMoved) onDragEnd?.();
        } else if (selectionRect !== null) {
          const worldRect = viewBoxRectToWorld(selectionRect, panX, panY, zoom);
          const ids = elementsInRect(worldRect, elements, measuredBounds);
          const modifiers = marqueeModifiersRef.current;
          if (modifiers.ctrlKey) {
            // Ctrl/Cmd: subtract from selection (remove elements in box)
            setSelectedElementIds((prev) => {
              const idsSet = new Set(ids);
              return prev.filter((id) => !idsSet.has(id));
            });
          } else if (modifiers.shiftKey) {
            // Shift: add to selection (union)
            setSelectedElementIds((prev) => {
              const combined = new Set([...prev, ...ids]);
              return Array.from(combined);
            });
          } else {
            // No modifier: replace selection
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
      flushDragMove,
      onDragEnd,
      panZoomHandlers,
      selectionHandlers,
    ]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if ((e.buttons & 1) === 0) {
        if (dragRafRef.current != null) {
          cancelAnimationFrame(dragRafRef.current);
          dragRafRef.current = null;
        }
        if (dragStateRef.current !== null) setIsDragging(false);
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
