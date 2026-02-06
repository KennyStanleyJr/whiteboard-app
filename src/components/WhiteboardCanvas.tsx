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
import type {
  ImageElement,
  ShapeType,
  WhiteboardElement,
} from "../types/whiteboard";
import type { FormatTag } from "../utils/textFormat";
import { hasNoTextCharacters } from "../utils/sanitizeHtml";
import { cn } from "@/lib/utils";
import {
  SelectionToolbar,
  type SelectionToolbarHandle,
} from "./SelectionToolbar";
import { WhiteboardCanvasSvg } from "./WhiteboardCanvasSvg";
import { WhiteboardErrorBoundary } from "./WhiteboardErrorBoundary";
import { WhiteboardToolbar } from "./WhiteboardToolbar";

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
  const {
    elements,
    setElements,
    persistNow,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useWhiteboardQuery();
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
    editingElementId,
    persistNow
  );

  const DEFAULT_SHAPE_WIDTH = 180;
  const DEFAULT_SHAPE_HEIGHT = 120;
  const DEFAULT_IMAGE_MAX_SIZE = 400;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      const w = DEFAULT_SHAPE_WIDTH;
      const h =
        shapeType === "ellipse" ? DEFAULT_SHAPE_WIDTH : DEFAULT_SHAPE_HEIGHT;
      const shapeElement: WhiteboardElement = {
        id,
        x: x - w / 2,
        y: y - h / 2,
        kind: "shape",
        shapeType,
        width: w,
        height: h,
        color: "#000000",
        filled: false,
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

  const addImageAt = useCallback(
    (x: number, y: number, src: string, imgWidth: number, imgHeight: number) => {
      const id = generateElementId();
      const maxDim = Math.max(imgWidth, imgHeight, 1);
      const scale = Math.min(1, DEFAULT_IMAGE_MAX_SIZE / maxDim);
      const w = Math.round(imgWidth * scale);
      const h = Math.round(imgHeight * scale);
      const imageElement: ImageElement = {
        id,
        x: x - w / 2,
        y: y - h / 2,
        kind: "image",
        src,
        width: w,
        height: h,
        naturalWidth: imgWidth,
        naturalHeight: imgHeight,
      };
      setElements((prev) => [...prev, imageElement]);
    },
    [setElements]
  );

  const addImageFromFile = useCallback(
    (file: File, worldX: number, worldY: number) => {
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result;
        if (typeof src !== "string") return;
        const img = new window.Image();
        img.onload = () => {
          addImageAt(worldX, worldY, src, img.naturalWidth, img.naturalHeight);
        };
        img.onerror = () => {
          console.error("[WhiteboardCanvas] Failed to load image dimensions");
        };
        img.src = src;
      };
      reader.onerror = () => {
        console.error("[WhiteboardCanvas] Failed to read file");
      };
      reader.readAsDataURL(file);
    },
    [addImageAt]
  );

  const handleAddImageClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files == null || files.length === 0) return;
      const file = files[0];
      if (file == null || !file.type.startsWith("image/")) return;
      const { x, y } = centerWorld();
      addImageFromFile(file, x, y);
      e.target.value = "";
    },
    [addImageFromFile, centerWorld]
  );

  const handleUpdateElementContent = useCallback((id: string, content: string) => {
    setElements((prev) => {
      // If content has no text characters, delete the element
      if (hasNoTextCharacters(content)) {
        return prev.filter((el) => el.id !== id);
      }
      // Otherwise update the content
      return prev.map((el) =>
        el.id === id && el.kind === "text" ? { ...el, content } : el
      );
    });
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
    /** Whether we have pushed pre-resize state to undo history (once per resize). */
    historyPushed: boolean;
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
        historyPushed: false,
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
        const modifiers = {
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey || e.metaKey,
        };
        const next = resizeBoundsFromHandle(
          state.startBounds,
          state.handleId,
          dx,
          dy,
          modifiers
        );
        const moved =
          next.x !== state.startBounds.x ||
          next.y !== state.startBounds.y ||
          next.width !== state.startBounds.width ||
          next.height !== state.startBounds.height;
        if (moved && !state.historyPushed) {
          // Push pre-resize state to undo history. pushToPast ignores the updater
          // return value and always pushes current to past.
          setElements((prev) => prev, { pushToPast: true });
          state.historyPushed = true;
        }
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
            if (el.kind === "image") {
              return {
                ...el,
                x: next.x,
                y: next.y,
                width: next.width,
                height: next.height,
              };
            }
            return el;
          }),
        { skipHistory: true }
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
    persistNow();
  }, [persistNow]);

  const handleImageNaturalDimensions = useCallback(
    (elementId: string, naturalWidth: number, naturalHeight: number) => {
      if (
        !Number.isFinite(naturalWidth) ||
        !Number.isFinite(naturalHeight) ||
        naturalWidth <= 0 ||
        naturalHeight <= 0
      ) {
        return;
      }
      setElements((prev) =>
        prev.map((el) => {
          if (el.kind !== "image" || el.id !== elementId) return el;
          if (el.naturalWidth != null && el.naturalHeight != null) return el;
          return { ...el, naturalWidth, naturalHeight };
        })
      );
    },
    [setElements]
  );

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
      const isUndo = (e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey) && !e.shiftKey;
      const isRedo =
        ((e.key === "y" || e.key === "Y") && (e.ctrlKey || e.metaKey)) ||
        ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey) && e.shiftKey);
      const isCopy = (e.key === "c" || e.key === "C") && (e.ctrlKey || e.metaKey);
      const isPaste = (e.key === "v" || e.key === "V") && (e.ctrlKey || e.metaKey);
      const isDuplicate = (e.key === "d" || e.key === "D") && (e.ctrlKey || e.metaKey);
      
      if (!isUndo && !isRedo && !isCopy && !isPaste && !isDuplicate) return;
      
      const target = e.target as HTMLElement;
      const tag = target.tagName?.toLowerCase();
      const role = target.getAttribute?.("role");
      const editable =
        tag === "input" ||
        tag === "textarea" ||
        target.isContentEditable ||
        role === "textbox";
      
      if (isUndo || isRedo) {
        if (editable) return;
        e.preventDefault();
        if (isUndo && canUndo) {
          undo();
        } else if (isRedo && canRedo) {
          redo();
        }
        return;
      }
      
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
  }, [
    editingElementId,
    handleCopySelected,
    handlePaste,
    handleDuplicateSelected,
    undo,
    redo,
    canUndo,
    canRedo,
  ]);

  const handlePasteImage = useCallback(
    (e: ClipboardEvent) => {
      const data = e.clipboardData;
      if (data == null) return;
      const item = Array.from(data.items).find((i) =>
        i.type.startsWith("image/")
      );
      if (item == null) return;
      const file = item.getAsFile();
      if (file == null) return;
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
          const { x, y } = centerWorld();
          pasteX = x;
          pasteY = y;
        }
      } else {
        const { x, y } = centerWorld();
        pasteX = x;
        pasteY = y;
      }
      e.preventDefault();
      addImageFromFile(file, pasteX, pasteY);
    },
    [addImageFromFile, centerWorld, panZoom, size]
  );

  const handleDropImage = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files == null || files.length === 0) return;
      const file = files[0];
      if (file == null || !file.type.startsWith("image/")) return;
      const container = panZoom.containerRef.current;
      if (container == null) return;
      const world = clientToWorld(
        container,
        e.clientX,
        e.clientY,
        size.width,
        size.height,
        panZoom.panX,
        panZoom.panY,
        panZoom.zoom
      );
      const { x, y } = world ?? centerWorld();
      addImageFromFile(file, x, y);
    },
    [addImageFromFile, centerWorld, panZoom, size]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent): void => {
      const target = e.target as HTMLElement;
      const tag = target.tagName?.toLowerCase();
      const editable =
        tag === "input" ||
        tag === "textarea" ||
        target.isContentEditable ||
        target.getAttribute?.("role") === "textbox";
      if (editable) return;
      if (editingElementId !== null) return;
      /* Prefer internal whiteboard clipboard; don't paste image if we have copied elements. */
      if (clipboardRef.current.length > 0) return;
      const data = e.clipboardData;
      if (data == null) return;
      const hasImage = Array.from(data.items).some((i) =>
        i.type.startsWith("image/")
      );
      if (hasImage) {
        e.preventDefault();
        handlePasteImage(e);
      }
    };
    document.addEventListener("paste", onPaste, { capture: true });
    return () =>
      document.removeEventListener("paste", onPaste, { capture: true });
  }, [editingElementId, handlePasteImage]);

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
        onDragOver={handleDragOver}
        onDrop={handleDropImage}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-hidden
          onChange={handleFileChange}
        />
        <WhiteboardToolbar
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onAddText={handleAddTextCenter}
          onAddRectangle={handleAddRectangleCenter}
          onAddEllipse={handleAddEllipseCenter}
          onAddImage={handleAddImageClick}
        />
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
        onImageNaturalDimensions={handleImageNaturalDimensions}
        isResizing={isResizing}
        toolbarContainerRef={toolbarContainerRef}
      />
      </div>
    </WhiteboardErrorBoundary>
  );
}
