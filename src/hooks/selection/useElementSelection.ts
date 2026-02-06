import { useCallback, useEffect, useRef, useState, RefObject } from "react";
import { clientToWorld } from "../canvas/canvasCoords";
import {
  elementAtPoint,
  elementsInRect,
  type ElementBounds,
} from "../../utils/elementBounds";
import type { WhiteboardElement } from "../../types/whiteboard";
import type { SelectionRect } from "./useSelectionBox";

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
  setElements: React.Dispatch<React.SetStateAction<WhiteboardElement[]>>,
  selectionRect: SelectionRect | null,
  measuredBounds: Record<string, ElementBounds>,
  selectionHandlers: ElementSelectionHandlers,
  panZoomHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerLeave: (e: React.PointerEvent) => void;
  },
  editingElementId: string | null
): {
  selectedElementIds: string[];
  isDragging: boolean;
  handlers: ElementSelectionHandlers;
} {
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);

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
        const idsToMove = isSelected ? selectedElementIds : [hit.id];
        setSelectedElementIds(idsToMove);
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
        };
        setIsDragging(true);
        (e.target as Element).setPointerCapture?.(e.pointerId);
        panZoomHandlers.onPointerDown(e);
      } else {
        setSelectedElementIds([]);
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
          setElements((prev) =>
            prev.map((el) => {
              const start = drag.startPositions.get(el.id);
              if (start === undefined) return el;
              return { ...el, x: start.x + dx, y: start.y + dy };
            })
          );
        }
        panZoomHandlers.onPointerMove(e);
        return;
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
      selectionHandlers,
      panZoomHandlers,
    ]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0) {
        if (dragStateRef.current !== null) {
          dragStateRef.current = null;
          setIsDragging(false);
          (e.target as Element).releasePointerCapture?.(e.pointerId);
        } else if (selectionRect !== null) {
          const worldRect = viewBoxRectToWorld(selectionRect, panX, panY, zoom);
          const ids = elementsInRect(worldRect, elements, measuredBounds);
          setSelectedElementIds(ids);
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
      panZoomHandlers,
      selectionHandlers,
    ]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if ((e.buttons & 1) === 0) {
        if (dragStateRef.current !== null) setIsDragging(false);
        dragStateRef.current = null;
      }
      selectionHandlers.handlePointerLeave(e);
    },
    [selectionHandlers]
  );

  return {
    selectedElementIds,
    isDragging,
    handlers: {
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      handlePointerLeave,
    },
  };
}
