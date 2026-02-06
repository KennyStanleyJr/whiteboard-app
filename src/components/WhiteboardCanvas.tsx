import { useCallback, useEffect, useRef, useState } from "react";
import { clientToWorld } from "../hooks/canvas/canvasCoords";
import {
  useCanvasEventListeners,
  useCanvasSize,
  useElementSelection,
  usePanZoom,
  useSelectionBox,
} from "../hooks";
import type { ElementBounds } from "../utils/elementBounds";
import {
  getElementBounds,
  sanitizeElementBounds,
} from "../utils/elementBounds";
import {
  resizeBoundsFromHandle,
  type ResizeHandleId,
} from "../utils/resizeHandles";
import type { WhiteboardElement } from "../types/whiteboard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SelectionToolbar } from "./SelectionToolbar";
import { WhiteboardCanvasSvg } from "./WhiteboardCanvasSvg";
import { WhiteboardErrorBoundary } from "./WhiteboardErrorBoundary";
import { TypeIcon } from "lucide-react";

function generateElementId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function WhiteboardCanvas(): JSX.Element {
  const panZoom = usePanZoom();
  const size = useCanvasSize(panZoom.containerRef);
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [measuredBounds, setMeasuredBounds] = useState<
    Record<string, ElementBounds>
  >({});

  const handleMeasuredBoundsChange = useCallback(
    (next: Record<string, ElementBounds>) => {
      setMeasuredBounds((prev) => ({ ...prev, ...next }));
    },
    []
  );

  const selection = useSelectionBox(
    panZoom.containerRef,
    size.width,
    size.height,
    panZoom.onPointerDown,
    panZoom.onPointerMove,
    panZoom.onPointerUp,
    panZoom.onPointerLeave
  );

  const elementSelection = useElementSelection(
    panZoom.containerRef,
    size.width,
    size.height,
    panZoom.panX,
    panZoom.panY,
    panZoom.zoom,
    elements,
    setElements,
    selection.selectionRect,
    measuredBounds,
    {
      handlePointerDown: selection.handlePointerDown,
      handlePointerMove: selection.handlePointerMove,
      handlePointerUp: selection.handlePointerUp,
      handlePointerLeave: selection.handlePointerLeave,
    },
    {
      onPointerDown: panZoom.onPointerDown,
      onPointerMove: panZoom.onPointerMove,
      onPointerUp: panZoom.onPointerUp,
      onPointerLeave: panZoom.onPointerLeave,
    },
    editingElementId
  );

  const addTextAt = useCallback((x: number, y: number) => {
    const id = generateElementId();
    const textElement: WhiteboardElement = {
      id,
      x,
      y,
      kind: "text",
      content: "",
    };
    setElements((prev) => [...prev, textElement]);
    setEditingElementId(id);
  }, []);

  const handleAddTextCenter = useCallback(() => {
    const centerViewportX = size.width / 2;
    const centerViewportY = size.height / 2;
    const x = (centerViewportX - panZoom.panX) / panZoom.zoom;
    const y = (centerViewportY - panZoom.panY) / panZoom.zoom;
    addTextAt(x, y);
  }, [addTextAt, panZoom.panX, panZoom.panY, panZoom.zoom, size.height, size.width]);

  const handleUpdateElementContent = useCallback((id: string, content: string) => {
    setElements((prev) =>
      prev.map((el) =>
        el.id === id && el.kind === "text" ? { ...el, content } : el
      )
    );
  }, []);

  const handleFinishEditElement = useCallback(() => {
    setEditingElementId(null);
  }, []);

  const [isResizing, setIsResizing] = useState(false);
  const resizeStateRef = useRef<{
    handleId: ResizeHandleId;
    elementId: string;
    startWorld: { x: number; y: number };
    startBounds: ElementBounds;
  } | null>(null);

  const handleResizeHandleDown = useCallback(
    (handleId: ResizeHandleId, e: React.PointerEvent) => {
      if (elementSelection.selectedElementIds.length !== 1) return;
      const elementId = elementSelection.selectedElementIds[0];
      if (elementId === undefined) return;
      const el = elements.find((x) => x.id === elementId);
      if (el == null) return;
      const rawBounds =
        measuredBounds[elementId] ?? getElementBounds(el, measuredBounds);
      const startBounds = sanitizeElementBounds(rawBounds);
      const world = clientToWorld(
        panZoom.containerRef.current,
        e.clientX,
        e.clientY,
        size.width,
        size.height,
        panZoom.panX,
        panZoom.panY,
        panZoom.zoom
      );
      if (world == null) return;
      setIsResizing(true);
      resizeStateRef.current = {
        handleId,
        elementId,
        startWorld: world,
        startBounds,
      };
    },
    [
      elementSelection.selectedElementIds,
      elements,
      measuredBounds,
      panZoom.containerRef,
      panZoom.panX,
      panZoom.panY,
      panZoom.zoom,
      size.width,
      size.height,
    ]
  );

  const handleResizeHandleMove = useCallback(
    (e: React.PointerEvent) => {
      try {
        const state = resizeStateRef.current;
        if (state == null) return;
        const world = clientToWorld(
          panZoom.containerRef.current,
          e.clientX,
          e.clientY,
          size.width,
          size.height,
          panZoom.panX,
          panZoom.panY,
          panZoom.zoom
        );
        if (world == null) return;
        const dx = world.x - state.startWorld.x;
        const dy = world.y - state.startWorld.y;
        const next = resizeBoundsFromHandle(
          state.startBounds,
          state.handleId,
          dx,
          dy
        );
        setElements((prev) =>
          prev.map((el) =>
            el.id === state.elementId && el.kind === "text"
              ? {
                  ...el,
                  x: next.x,
                  y: next.y,
                  width: next.width,
                  height: next.height,
                }
              : el
          )
        );
      } catch (err) {
        console.error("[WhiteboardCanvas] resize move error", err);
        resizeStateRef.current = null;
        setIsResizing(false);
      }
    },
    [
      panZoom.containerRef,
      panZoom.panX,
      panZoom.panY,
      panZoom.zoom,
      setElements,
      size.width,
      size.height,
    ]
  );

  const clearResizeState = useCallback(() => {
    resizeStateRef.current = null;
    setIsResizing(false);
  }, []);

  const handleResizeHandleUp = clearResizeState;
  const handleErrorRecover = clearResizeState;

  const selectedIdsRef = useRef<string[]>([]);
  selectedIdsRef.current = elementSelection.selectedElementIds;

  const handleDeleteSelected = useCallback(() => {
    const ids = new Set(selectedIdsRef.current);
    setElements((prev) => prev.filter((el) => !ids.has(el.id)));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (
        e.key !== "Delete" &&
        e.key !== "Backspace"
      ) return;
      if (selectedIdsRef.current.length === 0) return;
      if (editingElementId !== null) return;
      const target = e.target as HTMLElement;
      const tag = target.tagName?.toLowerCase();
      const role = target.getAttribute?.("role");
      const editable =
        tag === "input" ||
        tag === "textarea" ||
        target.isContentEditable ||
        role === "textbox";
      if (editable) return;
      e.preventDefault();
      handleDeleteSelected();
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [editingElementId, handleDeleteSelected]);

  useCanvasEventListeners(
    panZoom.containerRef,
    panZoom.handleWheelRaw,
    panZoom.handleTouchStart,
    panZoom.handleTouchMove,
    panZoom.handleTouchEnd
  );

  return (
    <WhiteboardErrorBoundary onRecover={handleErrorRecover}>
      <div
        ref={panZoom.containerRef as React.RefObject<HTMLDivElement>}
        className={cn(
          "whiteboard-canvas-wrap flex flex-col",
          elementSelection.isDragging && "is-dragging",
          isResizing && "is-resizing"
        )}
      >
        <div className="fixed left-5 top-[3.75rem] z-10 flex items-center rounded-full border border-border bg-background p-1.5 shadow-sm">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={handleAddTextCenter}
          aria-label="Add text"
        >
          <TypeIcon className="size-5" aria-hidden />
        </Button>
      </div>
      <SelectionToolbar
        containerRef={panZoom.containerRef as React.RefObject<HTMLDivElement>}
        selectedElementIds={elementSelection.selectedElementIds}
        elements={elements}
        setElements={setElements}
        measuredBounds={measuredBounds}
        panX={panZoom.panX}
        panY={panZoom.panY}
        zoom={panZoom.zoom}
        viewWidth={size.width}
        viewHeight={size.height}
      />
      <WhiteboardCanvasSvg
        panX={panZoom.panX}
        panY={panZoom.panY}
        zoom={panZoom.zoom}
        width={size.width}
        height={size.height}
        selectionRect={selection.selectionRect}
        selectedElementIds={elementSelection.selectedElementIds}
        measuredBounds={measuredBounds}
        onMeasuredBoundsChange={handleMeasuredBoundsChange}
        onPointerDown={elementSelection.handlers.handlePointerDown}
        onPointerMove={elementSelection.handlers.handlePointerMove}
        onPointerUp={elementSelection.handlers.handlePointerUp}
        onPointerLeave={elementSelection.handlers.handlePointerLeave}
        onContextMenu={panZoom.onContextMenu}
        isPanning={panZoom.isPanning}
        elements={elements}
        editingElementId={editingElementId}
        onElementDoubleClick={setEditingElementId}
        onUpdateElementContent={handleUpdateElementContent}
        onFinishEditElement={handleFinishEditElement}
        onResizeHandleDown={handleResizeHandleDown}
        onResizeHandleMove={handleResizeHandleMove}
        onResizeHandleUp={handleResizeHandleUp}
        isResizing={isResizing}
      />
      </div>
    </WhiteboardErrorBoundary>
  );
}
