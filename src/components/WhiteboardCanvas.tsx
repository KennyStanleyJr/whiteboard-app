import { useCallback, useEffect, useRef, useState } from "react";
import type { WhiteboardCanvasSvgHandle } from "./WhiteboardCanvasSvg";
import { clientToWorld } from "../hooks/canvas/canvasCoords";
import {
  useCanvasEventListeners,
  useCanvasSize,
  useElementSelection,
  usePanZoom,
  useSelectionBox,
  useWhiteboardQuery,
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
import type { ShapeType, WhiteboardElement } from "../types/whiteboard";
import type { FormatTag } from "../utils/textFormat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SelectionToolbar,
  type SelectionToolbarHandle,
} from "./SelectionToolbar";
import { WhiteboardCanvasSvg } from "./WhiteboardCanvasSvg";
import { WhiteboardErrorBoundary } from "./WhiteboardErrorBoundary";
import { Circle, Square, TypeIcon } from "lucide-react";

function generateElementId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const FORMAT_CMD_TO_TAG: Record<string, FormatTag> = {
  bold: "b",
  italic: "i",
  underline: "u",
};

export function WhiteboardCanvas(): JSX.Element {
  const panZoom = usePanZoom();
  const size = useCanvasSize(panZoom.containerRef);
  const { elements, setElements } = useWhiteboardQuery();
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [measuredBounds, setMeasuredBounds] = useState<
    Record<string, ElementBounds>
  >({});
  const canvasSvgRef = useRef<WhiteboardCanvasSvgHandle | null>(null);
  const toolbarContainerRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<SelectionToolbarHandle | null>(null);

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

  const DEFAULT_SHAPE_WIDTH = 120;
  const DEFAULT_SHAPE_HEIGHT = 80;

  const addTextAt = useCallback((x: number, y: number) => {
    const id = generateElementId();
    const textElement: WhiteboardElement = {
      id,
      x,
      y,
      kind: "text",
      content: "",
      fontSize: 24,
    };
    setElements((prev) => [...prev, textElement]);
    setEditingElementId(id);
  }, [setElements]);

  const addShapeAt = useCallback(
    (x: number, y: number, shapeType: ShapeType) => {
      const id = generateElementId();
      const shapeElement: WhiteboardElement = {
        id,
        x: x - DEFAULT_SHAPE_WIDTH / 2,
        y: y - DEFAULT_SHAPE_HEIGHT / 2,
        kind: "shape",
        shapeType,
        width: DEFAULT_SHAPE_WIDTH,
        height: DEFAULT_SHAPE_HEIGHT,
        color: "#000000",
        filled: true,
      };
      setElements((prev) => [...prev, shapeElement]);
    },
    [setElements]
  );

  const handleAddTextCenter = useCallback(() => {
    const centerViewportX = size.width / 2;
    const centerViewportY = size.height / 2;
    const x = (centerViewportX - panZoom.panX) / panZoom.zoom;
    const y = (centerViewportY - panZoom.panY) / panZoom.zoom;
    addTextAt(x, y);
  }, [addTextAt, panZoom.panX, panZoom.panY, panZoom.zoom, size.height, size.width]);

  const centerWorld = useCallback(() => {
    const centerViewportX = size.width / 2;
    const centerViewportY = size.height / 2;
    return {
      x: (centerViewportX - panZoom.panX) / panZoom.zoom,
      y: (centerViewportY - panZoom.panY) / panZoom.zoom,
    };
  }, [panZoom.panX, panZoom.panY, panZoom.zoom, size.height, size.width]);

  const handleAddRectangleCenter = useCallback(() => {
    const { x, y } = centerWorld();
    addShapeAt(x, y, "rectangle");
  }, [addShapeAt, centerWorld]);

  const handleAddEllipseCenter = useCallback(() => {
    const { x, y } = centerWorld();
    addShapeAt(x, y, "ellipse");
  }, [addShapeAt, centerWorld]);

  const handleUpdateElementContent = useCallback((id: string, content: string) => {
    setElements((prev) =>
      prev.map((el) =>
        el.id === id && el.kind === "text" ? { ...el, content } : el
      )
    );
  }, [setElements]);

  const handleFinishEditElement = useCallback(() => {
    setEditingElementId(null);
  }, []);

  const handleFormatCommand = useCallback(
    (command: string, value?: string) => {
      const canvas = canvasSvgRef.current;
      if (canvas == null) return;
      if (command === "foreColor" && value != null) {
        canvas.applyColorToEditorWithoutFocus(value);
        return;
      }
      const tag = FORMAT_CMD_TO_TAG[command];
      if (tag) canvas.applyFormatToEditingElement(tag);
    },
    []
  );

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
          prev.map((el) => {
            if (el.id !== state.elementId) return el;
            if (el.kind === "text") {
              return {
                ...el,
                x: next.x,
                y: next.y,
                width: next.width,
                height: next.height,
              };
            }
            if (el.kind === "shape") {
              return {
                ...el,
                x: next.x,
                y: next.y,
                width: next.width,
                height: next.height,
              };
            }
            return el;
          })
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
  }, [setElements]);

  interface ClipboardEntry {
    element: WhiteboardElement;
    bounds: ElementBounds;
  }
  const clipboardRef = useRef<ClipboardEntry[]>([]);
  const lastMousePositionRef = useRef<{ clientX: number; clientY: number } | null>(null);

  const handleCopySelected = useCallback(() => {
    const ids = new Set(selectedIdsRef.current);
    const copied: ClipboardEntry[] = [];
    for (const el of elements) {
      if (ids.has(el.id)) {
        const bounds = getElementBounds(el, measuredBounds);
        copied.push({ element: el, bounds });
      }
    }
    clipboardRef.current = copied;
  }, [elements, measuredBounds]);

  const handlePaste = useCallback(() => {
    if (clipboardRef.current.length === 0) return;
    const mousePos = lastMousePositionRef.current;
    const container = panZoom.containerRef.current;
    
    let pasteX: number;
    let pasteY: number;
    
    if (mousePos != null && container != null) {
      const world = clientToWorld(
        container,
        mousePos.clientX,
        mousePos.clientY,
        size.width,
        size.height,
        panZoom.panX,
        panZoom.panY,
        panZoom.zoom
      );
      if (world != null) {
        pasteX = world.x;
        pasteY = world.y;
      } else {
        const centerViewportX = size.width / 2;
        const centerViewportY = size.height / 2;
        pasteX = (centerViewportX - panZoom.panX) / panZoom.zoom;
        pasteY = (centerViewportY - panZoom.panY) / panZoom.zoom;
      }
    } else {
      const centerViewportX = size.width / 2;
      const centerViewportY = size.height / 2;
      pasteX = (centerViewportX - panZoom.panX) / panZoom.zoom;
      pasteY = (centerViewportY - panZoom.panY) / panZoom.zoom;
    }

    const clipboardEntries = clipboardRef.current;
    if (clipboardEntries.length === 0) return;

    let centerX = 0;
    let centerY = 0;
    let count = 0;
    for (const entry of clipboardEntries) {
      const bounds = entry.bounds;
      centerX += bounds.x + bounds.width / 2;
      centerY += bounds.y + bounds.height / 2;
      count += 1;
    }
    if (count > 0) {
      centerX /= count;
      centerY /= count;
    }

    const offsetX = pasteX - centerX;
    const offsetY = pasteY - centerY;

    const newElements: WhiteboardElement[] = clipboardEntries.map((entry) => {
      const el = entry.element;
      const newId = generateElementId();
      return {
        ...el,
        id: newId,
        x: el.x + offsetX,
        y: el.y + offsetY,
      };
    });
    setElements((prev) => [...prev, ...newElements]);
    const newIds = newElements.map((el) => el.id);
    elementSelection.setSelectedElementIds(newIds);
  }, [setElements, elementSelection, panZoom, size]);

  const handleDuplicateSelected = useCallback(() => {
    const ids = new Set(selectedIdsRef.current);
    if (ids.size === 0) return;
    const selectedElements = elements.filter((el) => ids.has(el.id));
    if (selectedElements.length === 0) return;

    const offsetX = 20;
    const offsetY = 20;

    const newElements: WhiteboardElement[] = selectedElements.map((el) => {
      const newId = generateElementId();
      return {
        ...el,
        id: newId,
        x: el.x + offsetX,
        y: el.y + offsetY,
      };
    });
    setElements((prev) => [...prev, ...newElements]);
    const newIds = newElements.map((el) => el.id);
    elementSelection.setSelectedElementIds(newIds);
  }, [elements, setElements, elementSelection]);

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

  useEffect(() => {
    const onMouseMove = (e: MouseEvent): void => {
      lastMousePositionRef.current = { clientX: e.clientX, clientY: e.clientY };
    };
    document.addEventListener("mousemove", onMouseMove);
    return () => document.removeEventListener("mousemove", onMouseMove);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const isCopy = (e.key === "c" || e.key === "C") && (e.ctrlKey || e.metaKey);
      const isPaste = (e.key === "v" || e.key === "V") && (e.ctrlKey || e.metaKey);
      const isDuplicate = (e.key === "d" || e.key === "D") && (e.ctrlKey || e.metaKey);
      if (!isCopy && !isPaste && !isDuplicate) return;
      const target = e.target as HTMLElement;
      const tag = target.tagName?.toLowerCase();
      const role = target.getAttribute?.("role");
      const editable =
        tag === "input" ||
        tag === "textarea" ||
        target.isContentEditable ||
        role === "textbox";
      if (editable) return;
      if (isCopy) {
        if (selectedIdsRef.current.length === 0) return;
        if (editingElementId !== null) return;
        e.preventDefault();
        handleCopySelected();
      } else if (isPaste) {
        if (editingElementId !== null) return;
        e.preventDefault();
        handlePaste();
      } else if (isDuplicate) {
        if (selectedIdsRef.current.length === 0) return;
        if (editingElementId !== null) return;
        e.preventDefault();
        handleDuplicateSelected();
      }
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [editingElementId, handleCopySelected, handlePaste, handleDuplicateSelected]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const key = e.key.toLowerCase();
      if (key !== "b" && key !== "i" && key !== "u") return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      const hasTextSelected = elements.some(
        (el) =>
          el.kind === "text" &&
          elementSelection.selectedElementIds.includes(el.id)
      );
      if (!hasTextSelected) return;
      e.preventDefault();
      if (key === "b") toolbarRef.current?.applyBold();
      else if (key === "i") toolbarRef.current?.applyItalic();
      else toolbarRef.current?.applyUnderline();
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [elements, elementSelection.selectedElementIds]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const key = e.key.toLowerCase();
      if (key !== "f") return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      const hasShapeSelected = elements.some(
        (el) =>
          el.kind === "shape" &&
          elementSelection.selectedElementIds.includes(el.id)
      );
      if (!hasShapeSelected) return;
      e.preventDefault();
      toolbarRef.current?.toggleShapeFilled();
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [elements, elementSelection.selectedElementIds]);

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
        <div className="fixed left-5 top-[3.75rem] z-10 flex flex-col items-center gap-1 rounded-full border border-border bg-background p-1.5 shadow-sm">
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
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={handleAddRectangleCenter}
            aria-label="Add rectangle"
          >
            <Square className="size-5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={handleAddEllipseCenter}
            aria-label="Add ellipse"
          >
            <Circle className="size-5" aria-hidden />
          </Button>
        </div>
      <div ref={toolbarContainerRef}>
        <SelectionToolbar
          ref={toolbarRef}
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
          editingElementId={editingElementId}
          onFormatCommand={handleFormatCommand}
        />
      </div>
      <WhiteboardCanvasSvg
        ref={canvasSvgRef}
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
        toolbarContainerRef={toolbarContainerRef}
      />
      </div>
    </WhiteboardErrorBoundary>
  );
}
