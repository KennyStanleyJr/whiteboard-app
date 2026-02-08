import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { WhiteboardCanvasSvgHandle } from "./WhiteboardCanvasSvg";
import { clientToWorld } from "../hooks/canvas/canvasCoords";
import {
  useCanvasEventListeners,
  useCanvasSize,
  useElementSelection,
  useFillModeTextState,
  usePanZoom,
  useSelectionBox,
  useWhiteboardQuery,
} from "../hooks";
import type { ElementBounds } from "../lib/elementBounds";
import {
  elementAtPoint,
  getElementBounds,
  sanitizeElementBounds,
} from "../lib/elementBounds";
import {
  clampBoundsToMax,
  resizeBoundsFromHandle,
  type ResizeHandleId,
} from "../lib/resizeHandles";
import type {
  ImageElement,
  ShapeType,
  WhiteboardElement,
} from "../types/whiteboard";
import type { FormatTag } from "../lib/textFormat";
import { getContrastingTextColor } from "../lib/contrastColor";
import { hasNoTextCharacters, plainTextToHtml } from "../lib/sanitizeHtml";
import { cn } from "@/lib/utils";
import {
  SelectionToolbar,
  type SelectionToolbarHandle,
} from "./SelectionToolbar";
import { CanvasContextMenu } from "./SelectionToolbar/CanvasContextMenu";
import { ElementContextMenu } from "./SelectionToolbar/ElementContextMenu";
import {
  imageSrcToFile,
  optimizeImage,
  OPTIMIZE_IMAGE_MAX_DIMENSION,
} from "../lib/optimizeImage";
import type { ImportImageOptionsItem } from "./SelectionToolbar/ImportImageOptionsDialog";
import { ImageInfoDialog } from "./SelectionToolbar/ImageInfoDialog";
import { ImportImageOptionsDialog } from "./SelectionToolbar/ImportImageOptionsDialog";
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

/**
 * Reducer: canvas UI (text editing, context menu, image info dialog).
 * Only one of context menu / image info is shown at a time; opening one closes the other. RESET clears all when board changes.
 */
type CanvasUiState = {
  editingElementId: string | null;
  contextMenu: { x: number; y: number; type: "element" | "canvas" } | null;
  imageInfoDialogElementId: string | null;
};
type CanvasUiAction =
  | { type: "SET_EDITING"; payload: string | null }
  | { type: "OPEN_CONTEXT_MENU"; payload: { x: number; y: number; type: "element" | "canvas" } }
  | { type: "CLOSE_CONTEXT_MENU" }
  | { type: "OPEN_IMAGE_INFO"; payload: string }
  | { type: "CLOSE_IMAGE_INFO" }
  | { type: "RESET" };

function canvasUiReducer(state: CanvasUiState, action: CanvasUiAction): CanvasUiState {
  switch (action.type) {
    case "SET_EDITING":
      return { ...state, editingElementId: action.payload };
    case "OPEN_CONTEXT_MENU":
      return { ...state, contextMenu: action.payload };
    case "CLOSE_CONTEXT_MENU":
      return { ...state, contextMenu: null };
    case "OPEN_IMAGE_INFO":
      return {
        ...state,
        imageInfoDialogElementId: action.payload,
        contextMenu: null,
      };
    case "CLOSE_IMAGE_INFO":
      return { ...state, imageInfoDialogElementId: null };
    case "RESET":
      return {
        editingElementId: null,
        contextMenu: null,
        imageInfoDialogElementId: null,
      };
    default:
      return state;
  }
}

const INITIAL_CANVAS_UI: CanvasUiState = {
  editingElementId: null,
  contextMenu: null,
  imageInfoDialogElementId: null,
};

/** Reducer: resize handle state machine. Only one element can be resized at a time. */
type ResizeState = "idle" | "resizing";
type ResizeAction = { type: "START" } | { type: "END" };
function resizeReducer(state: ResizeState, action: ResizeAction): ResizeState {
  switch (action.type) {
    case "START": return "resizing";
    case "END": return "idle";
    default: return state;
  }
}

/**
 * Reducer: import/paste flow (pending images, optional paste text, optimizing flags).
 * CLOSE_IMPORT_DIALOG clears pending items and stops optimizing; used when dialog closes.
 */
type PendingPasteText = { x: number; y: number; content: string };
type ImportPasteState = {
  pendingImportItems: ImportImageOptionsItem[];
  pendingPasteText: PendingPasteText | null;
  isOptimizingImage: boolean;
  isOptimizingImport: boolean;
};
type ImportPasteAction =
  | { type: "SET_PENDING_IMPORT"; payload: React.SetStateAction<ImportImageOptionsItem[]> }
  | { type: "SET_PENDING_PASTE"; payload: React.SetStateAction<PendingPasteText | null> }
  | { type: "SET_OPTIMIZING_IMAGE"; payload: boolean }
  | { type: "SET_OPTIMIZING_IMPORT"; payload: boolean }
  | { type: "CLOSE_IMPORT_DIALOG" };

function importPasteReducer(state: ImportPasteState, action: ImportPasteAction): ImportPasteState {
  switch (action.type) {
    case "SET_PENDING_IMPORT": {
      const next = typeof action.payload === "function"
        ? action.payload(state.pendingImportItems)
        : action.payload;
      return { ...state, pendingImportItems: next };
    }
    case "SET_PENDING_PASTE": {
      const next = typeof action.payload === "function"
        ? action.payload(state.pendingPasteText)
        : action.payload;
      return { ...state, pendingPasteText: next };
    }
    case "SET_OPTIMIZING_IMAGE":
      return { ...state, isOptimizingImage: action.payload };
    case "SET_OPTIMIZING_IMPORT":
      return { ...state, isOptimizingImport: action.payload };
    case "CLOSE_IMPORT_DIALOG":
      return {
        ...state,
        pendingImportItems: [],
        pendingPasteText: null,
        isOptimizingImport: false,
      };
    default:
      return state;
  }
}

const INITIAL_IMPORT_PASTE: ImportPasteState = {
  pendingImportItems: [],
  pendingPasteText: null,
  isOptimizingImage: false,
  isOptimizingImport: false,
};

/** Reducer: measured element bounds (from layout). MERGE adds/updates; RESET on board change. */
type BoundsAction =
  | { type: "MERGE"; payload: Record<string, ElementBounds> }
  | { type: "RESET" };
function measuredBoundsReducer(
  state: Record<string, ElementBounds>,
  action: BoundsAction
): Record<string, ElementBounds> {
  switch (action.type) {
    case "MERGE":
      return { ...state, ...action.payload };
    case "RESET":
      return {};
    default:
      return state;
  }
}

export interface WhiteboardCanvasProps {
  boardId?: string;
}

export function WhiteboardCanvas({ boardId }: WhiteboardCanvasProps = {}): JSX.Element {
  const panZoom = usePanZoom({ boardId });
  const size = useCanvasSize(panZoom.containerRef);
  const {
    elements,
    setElements,
    persistNow,
    undo,
    redo,
    canUndo,
    canRedo,
    backgroundColor,
    gridStyle,
  } = useWhiteboardQuery(boardId);
  const [canvasUi, dispatchCanvasUi] = useReducer(
    canvasUiReducer,
    INITIAL_CANVAS_UI
  );
  const { editingElementId, contextMenu, imageInfoDialogElementId } = canvasUi;
  const [measuredBounds, dispatchMeasuredBounds] = useReducer(
    measuredBoundsReducer,
    {}
  );
  const [resizeState, dispatchResize] = useReducer(resizeReducer, "idle");
  const isResizing = resizeState === "resizing";
  const [importPaste, dispatchImportPaste] = useReducer(
    importPasteReducer,
    INITIAL_IMPORT_PASTE
  );
  const {
    pendingImportItems,
    isOptimizingImage,
    isOptimizingImport,
  } = importPaste;
  const canvasSvgRef = useRef<WhiteboardCanvasSvgHandle | null>(null);
  const toolbarContainerRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<SelectionToolbarHandle | null>(null);
  const lastBoardIdRef = useRef<string | undefined>(boardId);
  const editingElementIdRef = useRef<string | null>(null);
  useEffect(() => {
    editingElementIdRef.current = editingElementId;
  }, [editingElementId]);

  const fillModeText = useFillModeTextState(setElements);
  const {
    handleEffectiveFontSize,
    getEffectiveFontSize,
    handleTextAspectRatio,
    handleMaxFillBoxSize,
    handleFillFittedSize,
    getFillFittedSize,
    registerFillOnPendingFit,
    getResizeConstraints,
  } = fillModeText;

  // On board switch: clear measured bounds and canvas UI (editing, menus, dialogs)
  useEffect(() => {
    if (lastBoardIdRef.current !== boardId) {
      lastBoardIdRef.current = boardId;
      dispatchMeasuredBounds({ type: "RESET" });
      dispatchCanvasUi({ type: "RESET" });
    }
  }, [boardId]);

  const handleMeasuredBoundsChange = useCallback(
    (next: Record<string, ElementBounds>) => {
      dispatchMeasuredBounds({ type: "MERGE", payload: next });
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
    persistNow,
    toolbarContainerRef
  );

  const DEFAULT_SHAPE_WIDTH = 180;
  const DEFAULT_SHAPE_HEIGHT = 120;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /** Reference on-screen pixel size for new text when placed (used with zoom to get world-space fontSize). */
  const DEFAULT_TEXT_SCREEN_PX = 36;

  /** Default fontSize and textColor for new text at current zoom and background (toolbar, paste, drop). */
  const getDefaultTextPlacementStyle = useCallback(() => {
    const zoomSafe = Math.max(panZoom.zoom, 0.001);
    return {
      fontSize: Math.round(DEFAULT_TEXT_SCREEN_PX / zoomSafe),
      textColor: getContrastingTextColor(backgroundColor),
    };
  }, [panZoom.zoom, backgroundColor]);

  const addTextAtWithContent = useCallback(
    (
      x: number,
      y: number,
      plainText: string,
      fontSize?: number,
      initialColor?: string
    ) => {
      const id = generateElementId();
      let content = plainTextToHtml(plainText.trim());
      if (initialColor != null && /^#[0-9A-Fa-f]{6}$/.test(initialColor)) {
        content = `<span style="color: ${initialColor}">${content}</span>`;
      }
      const size =
        fontSize != null ? Math.round(fontSize) : DEFAULT_TEXT_SCREEN_PX;
      const textElement: WhiteboardElement = {
        id,
        x,
        y,
        kind: "text",
        content,
        fontSize: size,
      };
      setElements((prev) => [...prev, textElement]);
    },
    [setElements]
  );

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
    const { fontSize, textColor } = getDefaultTextPlacementStyle();
    addTextAtWithContent(x, y, "Text", fontSize, textColor);
  }, [
    addTextAtWithContent,
    getDefaultTextPlacementStyle,
    panZoom.panX,
    panZoom.panY,
    panZoom.zoom,
    size.height,
    size.width,
  ]);

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
      const imageElement: ImageElement = {
        id,
        x: x - imgWidth / 2,
        y: y - imgHeight / 2,
        kind: "image",
        src,
        width: imgWidth,
        height: imgHeight,
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
      e.target.value = "";
      const { x, y } = centerWorld();
      dispatchImportPaste({
        type: "SET_PENDING_IMPORT",
        payload: [{ file, worldX: x, worldY: y }],
      });
    },
    [centerWorld]
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
    const id = editingElementIdRef.current;
    dispatchCanvasUi({ type: "SET_EDITING", payload: null });
    if (id != null) {
      const el = elements.find((e) => e.id === id);
      if (el?.kind === "text" && el.fill !== false) {
        registerFillOnPendingFit([id]);
      }
    }
  }, [elements, registerFillOnPendingFit]);

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

  const resizeStateRef = useRef<{
    handleId: ResizeHandleId;
    elementId: string;
    startWorld: { x: number; y: number };
    startBounds: ElementBounds;
    /** Whether we have pushed pre-resize state to undo history (once per resize). */
    historyPushed: boolean;
    /** When set (e.g. text in fill mode), resize is locked to this aspect ratio. */
    fixedAspectRatio?: number;
    /** When set (text fill at max), box size is capped to this. */
    maxFillBoxSize?: { width: number; height: number };
  } | null>(null);

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const importOptimizeBatchIdRef = useRef(0);

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
      const constraints =
        el.kind === "text" && el.fill !== false
          ? getResizeConstraints(elementId)
          : {};
      dispatchResize({ type: "START" });
      resizeStateRef.current = {
        handleId,
        elementId,
        startWorld: world,
        startBounds,
        historyPushed: false,
        fixedAspectRatio: constraints.fixedAspectRatio,
        maxFillBoxSize: constraints.maxFillBoxSize,
      };
    },
    [
      elementSelection.selectedElementIds,
      elements,
      getResizeConstraints,
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
        let next = resizeBoundsFromHandle(
          state.startBounds,
          state.handleId,
          dx,
          dy,
          modifiers,
          state.fixedAspectRatio
        );
        if (state.maxFillBoxSize != null) {
          next = clampBoundsToMax(next, state.maxFillBoxSize, state.handleId);
        }
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
        dispatchResize({ type: "END" });
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
    dispatchResize({ type: "END" });
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
    /* Clear system clipboard so the next paste only pastes the copied elements. */
    navigator.clipboard.writeText("").catch(() => {});
  }, [elements, measuredBounds]);

  const getPastePosition = useCallback(() => {
    const mousePos = lastMousePositionRef.current;
    const container = panZoom.containerRef.current;
    const centerViewportX = size.width / 2;
    const centerViewportY = size.height / 2;
    const centerX = (centerViewportX - panZoom.panX) / panZoom.zoom;
    const centerY = (centerViewportY - panZoom.panY) / panZoom.zoom;
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
      if (world != null) return { x: world.x, y: world.y };
    }
    return { x: centerX, y: centerY };
  }, [
    panZoom.containerRef,
    panZoom.panX,
    panZoom.panY,
    panZoom.zoom,
    size.width,
    size.height,
  ]);

  const PASTE_OFFSET_Y = 24;

  const handlePaste = useCallback(() => {
    const { x: baseX, y: baseY } = getPastePosition();
    const nextY = baseY;

    const pasteAppClipboard = (pasteY: number) => {
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
      if (count === 0) return;
      centerX /= count;
      centerY /= count;
      const offsetX = baseX - centerX;
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
      elementSelection.setSelectedElementIds(newElements.map((el) => el.id));
    };

    /* Paste system clipboard first (images + text), then app clipboard below. */
    void navigator.clipboard.read().then((items) => {
      const imageFiles: File[] = [];
      let textContent: string | null = null;

      const processItem = async (item: ClipboardItem): Promise<void> => {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType != null) {
          const blob = await item.getType(imageType);
          imageFiles.push(new File([blob], "pasted.png", { type: blob.type }));
        }
        if (item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain");
          const t = (await blob.text()).trim();
          if (t.length > 0) textContent = t;
        }
      };

      return Promise.all(items.map((item) => processItem(item))).then(() => {
        const hasSystemContent = imageFiles.length > 0 || textContent != null;
        if (hasSystemContent) {
          if (imageFiles.length > 0) {
            const importItems: ImportImageOptionsItem[] = imageFiles.map(
              (file, i) => ({
                file,
                worldX: baseX,
                worldY: nextY + i * PASTE_OFFSET_Y * 5,
              })
            );
            dispatchImportPaste({
              type: "SET_PENDING_IMPORT",
              payload: importItems,
            });
            if (textContent != null) {
              dispatchImportPaste({
                type: "SET_PENDING_PASTE",
                payload: {
                  x: baseX,
                  y: nextY + imageFiles.length * PASTE_OFFSET_Y * 5,
                  content: textContent,
                },
              });
            }
          } else if (textContent != null) {
            const { fontSize, textColor } = getDefaultTextPlacementStyle();
            addTextAtWithContent(baseX, nextY, textContent, fontSize, textColor);
          }
          return;
        }
        pasteAppClipboard(baseY);
      });
    }).catch(() => {
      /* Clipboard read denied: still paste app clipboard. */
      pasteAppClipboard(baseY);
    });
  }, [
    getPastePosition,
    setElements,
    elementSelection,
    addTextAtWithContent,
    getDefaultTextPlacementStyle,
  ]);

  const handleMoveUp = useCallback(() => {
    const ids = new Set(elementSelection.selectedElementIds);
    if (ids.size === 0) return;
    setElements((prev) => {
      const result = [...prev];
      // Move selected elements one position forward (toward end)
      for (let i = result.length - 1; i >= 0; i -= 1) {
        const current = result[i];
        if (current != null && ids.has(current.id)) {
          // If not already at the end, swap with next element
          const next = result[i + 1];
          if (i < result.length - 1 && next != null && !ids.has(next.id)) {
            result[i] = next;
            result[i + 1] = current;
          }
        }
      }
      return result;
    });
  }, [elementSelection.selectedElementIds, setElements]);

  const handleMoveDown = useCallback(() => {
    const ids = new Set(elementSelection.selectedElementIds);
    if (ids.size === 0) return;
    setElements((prev) => {
      const result = [...prev];
      // Move selected elements one position backward (toward beginning)
      for (let i = 0; i < result.length; i += 1) {
        const current = result[i];
        if (current != null && ids.has(current.id)) {
          // If not already at the beginning, swap with previous element
          const prev = result[i - 1];
          if (i > 0 && prev != null && !ids.has(prev.id)) {
            result[i] = prev;
            result[i - 1] = current;
          }
        }
      }
      return result;
    });
  }, [elementSelection.selectedElementIds, setElements]);

  const handleSendToBack = useCallback(() => {
    const ids = new Set(elementSelection.selectedElementIds);
    if (ids.size === 0) return;
    setElements((prev) => {
      const selected: WhiteboardElement[] = [];
      const unselected: WhiteboardElement[] = [];
      for (const el of prev) {
        if (ids.has(el.id)) selected.push(el);
        else unselected.push(el);
      }
      return [...selected, ...unselected];
    });
  }, [elementSelection.selectedElementIds, setElements]);

  const handleSendToFront = useCallback(() => {
    const ids = new Set(elementSelection.selectedElementIds);
    if (ids.size === 0) return;
    setElements((prev) => {
      const selected: WhiteboardElement[] = [];
      const unselected: WhiteboardElement[] = [];
      for (const el of prev) {
        if (ids.has(el.id)) selected.push(el);
        else unselected.push(el);
      }
      return [...unselected, ...selected];
    });
  }, [elementSelection.selectedElementIds, setElements]);

  const selectedImageForInfo = useMemo((): ImageElement | null => {
    if (elementSelection.selectedElementIds.length !== 1) return null;
    const id = elementSelection.selectedElementIds[0];
    const el = elements.find((e) => e.id === id);
    return el?.kind === "image" ? el : null;
  }, [elements, elementSelection.selectedElementIds]);

  const imageInfoDialogImage = useMemo((): ImageElement | null => {
    if (imageInfoDialogElementId == null) return null;
    const el = elements.find((e) => e.id === imageInfoDialogElementId);
    return el?.kind === "image" ? el : null;
  }, [elements, imageInfoDialogElementId]);

  useEffect(() => {
    if (
      imageInfoDialogElementId != null &&
      imageInfoDialogImage == null
    ) {
      dispatchCanvasUi({ type: "CLOSE_IMAGE_INFO" });
    }
  }, [imageInfoDialogElementId, imageInfoDialogImage]);

  const handleGetImageInfo = useCallback(() => {
    if (selectedImageForInfo == null) return;
    dispatchCanvasUi({ type: "OPEN_IMAGE_INFO", payload: selectedImageForInfo.id });
  }, [selectedImageForInfo]);

  const handleImageInfoDialogOpenChange = useCallback((open: boolean) => {
    if (!open) dispatchCanvasUi({ type: "CLOSE_IMAGE_INFO" });
  }, []);

  const handleOptimizeImage = useCallback(() => {
    const img = imageInfoDialogImage;
    if (img == null) return;
    dispatchImportPaste({ type: "SET_OPTIMIZING_IMAGE", payload: true });
    const w = img.naturalWidth ?? img.width;
    const h = img.naturalHeight ?? img.height;
    const maxDim = Math.max(w, h, 1);
    void imageSrcToFile(img.src)
      .then((file) => optimizeImage(file, maxDim))
      .then(({ dataUrl, width: natW, height: natH }) => {
        // Only replace if the optimized result is actually smaller (avoid increasing file size).
        if (dataUrl.length >= img.src.length) return;
        // Replace pixel data and natural size; keep display size so the image does not grow on canvas.
        setElements((prev) =>
          prev.map((el) =>
            el.id === img.id && el.kind === "image"
              ? {
                  ...el,
                  src: dataUrl,
                  naturalWidth: natW,
                  naturalHeight: natH,
                }
              : el
          )
        );
      })
      .catch(() => {
        // e.g. revoked blob URL or invalid image; keep original
      })
      .finally(() =>
        dispatchImportPaste({ type: "SET_OPTIMIZING_IMAGE", payload: false })
      );
  }, [imageInfoDialogImage, setElements]);

  const flushPendingPasteText = useCallback(() => {
    const { fontSize, textColor } = getDefaultTextPlacementStyle();
    dispatchImportPaste({
      type: "SET_PENDING_PASTE",
      payload: (text) => {
        if (text != null)
          addTextAtWithContent(text.x, text.y, text.content, fontSize, textColor);
        return null;
      },
    });
  }, [addTextAtWithContent, getDefaultTextPlacementStyle]);

  const handleImportKeepOriginal = useCallback(() => {
    dispatchImportPaste({
      type: "SET_PENDING_IMPORT",
      payload: (items) => {
        flushPendingPasteText();
        for (const item of items) {
          addImageFromFile(item.file, item.worldX, item.worldY);
        }
        return [];
      },
    });
  }, [addImageFromFile, flushPendingPasteText]);

  const handleImportOptimize = useCallback(() => {
    const items = importPaste.pendingImportItems;
    if (items.length === 0) return;
    const batchId = (importOptimizeBatchIdRef.current += 1);
    dispatchImportPaste({ type: "SET_OPTIMIZING_IMPORT", payload: true });
    let completed = 0;
    const done = (): void => {
      completed += 1;
      if (completed >= items.length) {
        if (batchId === importOptimizeBatchIdRef.current) {
          dispatchImportPaste({ type: "SET_PENDING_IMPORT", payload: [] });
          flushPendingPasteText();
          dispatchImportPaste({ type: "SET_OPTIMIZING_IMPORT", payload: false });
        }
      }
    };
    for (const item of items) {
      void optimizeImage(item.file, OPTIMIZE_IMAGE_MAX_DIMENSION)
        .then(({ dataUrl, width, height }) => {
          addImageAt(item.worldX, item.worldY, dataUrl, width, height);
        })
        .catch(() => {
          addImageFromFile(item.file, item.worldX, item.worldY);
        })
        .finally(done);
    }
  }, [addImageAt, addImageFromFile, flushPendingPasteText, importPaste.pendingImportItems]);

  const handleImportDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      dispatchImportPaste({ type: "CLOSE_IMPORT_DIALOG" });
      importOptimizeBatchIdRef.current += 1;
    }
  }, []);

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

  const handleCutSelected = useCallback(() => {
    handleCopySelected();
    handleDeleteSelected();
  }, [handleCopySelected, handleDeleteSelected]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent): void => {
      if (panZoom.isPanning) return;
      if (editingElementId !== null) return;

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
      if (world == null) return;

      const hit = elementAtPoint(world.x, world.y, elements, measuredBounds);
      const onSelectedElement =
        hit != null &&
        elementSelection.selectedElementIds.length > 0 &&
        elementSelection.selectedElementIds.includes(hit.id);

      e.preventDefault();
      const menuPayload = { x: e.clientX, y: e.clientY, type: "element" as const };
      const canvasPayload = { x: e.clientX, y: e.clientY, type: "canvas" as const };
      if (onSelectedElement) {
        dispatchCanvasUi({ type: "OPEN_CONTEXT_MENU", payload: menuPayload });
      } else {
        lastMousePositionRef.current = { clientX: e.clientX, clientY: e.clientY };
        if (clipboardRef.current.length > 0) {
          dispatchCanvasUi({ type: "OPEN_CONTEXT_MENU", payload: canvasPayload });
        } else {
          navigator.clipboard.read().then((items) => {
            let hasImage = false;
            const textChecks: Promise<boolean>[] = [];
            for (const item of items) {
              for (const type of item.types) {
                if (type.startsWith("image/")) hasImage = true;
                if (type === "text/plain") {
                  textChecks.push(
                    item.getType("text/plain").then((b) => b.text()).then((t) => t.trim().length > 0)
                  );
                }
              }
            }
            if (hasImage) {
              dispatchCanvasUi({ type: "OPEN_CONTEXT_MENU", payload: canvasPayload });
              return;
            }
            void Promise.all(textChecks).then((results) => {
              if (results.some(Boolean)) {
                dispatchCanvasUi({ type: "OPEN_CONTEXT_MENU", payload: canvasPayload });
              }
            });
          }).catch(() => { /* clipboard read permission denied */ });
        }
      }
    },
    [
      panZoom.isPanning,
      panZoom.containerRef,
      panZoom.panX,
      panZoom.panY,
      panZoom.zoom,
      elementSelection.selectedElementIds,
      editingElementId,
      elements,
      measuredBounds,
      size.width,
      size.height,
    ]
  );

  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent) => {
      panZoom.onContextMenu(e);
      if (panZoom.contextMenuSuppressedRef.current) {
        panZoom.contextMenuSuppressedRef.current = false;
        return;
      }
      handleContextMenu(e);
    },
    // Intentionally depend on stable ref/callback only; panZoom object identity changes each render
    // eslint-disable-next-line react-hooks/exhaustive-deps -- panZoom.onContextMenu, panZoom.contextMenuSuppressedRef are stable
    [panZoom.onContextMenu, panZoom.contextMenuSuppressedRef, handleContextMenu]
  );

  useEffect(() => {
    if (contextMenu == null) return;
    const closeOnClick = (e: MouseEvent): void => {
      const el = contextMenuRef.current;
      if (el != null && !el.contains(e.target as Node)) {
        dispatchCanvasUi({ type: "CLOSE_CONTEXT_MENU" });
      }
    };
    const closeOnEscape = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        dispatchCanvasUi({ type: "CLOSE_CONTEXT_MENU" });
      }
    };
    document.addEventListener("mousedown", closeOnClick, { capture: true });
    document.addEventListener("keydown", closeOnEscape, { capture: true });
    return () => {
      document.removeEventListener("mousedown", closeOnClick, { capture: true });
      document.removeEventListener("keydown", closeOnEscape, { capture: true });
    };
  }, [contextMenu]);

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
  }, [
    editingElementId,
    handleDeleteSelected,
    handleCutSelected,
    handleCopySelected,
    handlePaste,
    handleDuplicateSelected,
    handleMoveUp,
    handleMoveDown,
    undo,
    redo,
    canUndo,
    canRedo,
  ]);

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
      const isCut = (e.key === "x" || e.key === "X") && (e.ctrlKey || e.metaKey);
      const isCopy = (e.key === "c" || e.key === "C") && (e.ctrlKey || e.metaKey);
      /* Paste (Ctrl+V) is handled only by the document paste listener to avoid double-paste. */
      const isDuplicate = (e.key === "d" || e.key === "D") && (e.ctrlKey || e.metaKey);
      const isMoveUp = e.key === "]" && (e.ctrlKey || e.metaKey);
      const isMoveDown = e.key === "[" && (e.ctrlKey || e.metaKey);
      
      if (!isUndo && !isRedo && !isCut && !isCopy && !isDuplicate && !isMoveUp && !isMoveDown) return;
      
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
      if (isCut) {
        if (selectedIdsRef.current.length === 0) return;
        if (editingElementId !== null) return;
        e.preventDefault();
        handleCutSelected();
      } else if (isCopy) {
        if (selectedIdsRef.current.length === 0) return;
        if (editingElementId !== null) return;
        e.preventDefault();
        handleCopySelected();
      } else if (isDuplicate) {
        if (selectedIdsRef.current.length === 0) return;
        if (editingElementId !== null) return;
        e.preventDefault();
        handleDuplicateSelected();
      } else if (isMoveUp) {
        if (selectedIdsRef.current.length === 0) return;
        if (editingElementId !== null) return;
        e.preventDefault();
        handleMoveUp();
      } else if (isMoveDown) {
        if (selectedIdsRef.current.length === 0) return;
        if (editingElementId !== null) return;
        e.preventDefault();
        handleMoveDown();
      }
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [
    editingElementId,
    handleCutSelected,
    handleCopySelected,
    handleDuplicateSelected,
    handleMoveUp,
    handleMoveDown,
    undo,
    redo,
    canUndo,
    canRedo,
  ]);

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
      dispatchImportPaste({
        type: "SET_PENDING_IMPORT",
        payload: [{ file, worldX: x, worldY: y }],
      });
    },
    [centerWorld, panZoom, size]
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
      const data = e.clipboardData;
      if (data == null) return;
      const items = Array.from(data.items);
      const hasImage = items.some((i) => i.type.startsWith("image/"));
      const text = data.getData("text/plain")?.trim();
      const hasText = (text?.length ?? 0) > 0;
      const hasAppClipboard = clipboardRef.current.length > 0;
      if (!hasImage && !hasText && !hasAppClipboard) return;
      e.preventDefault();
      const { x: baseX, y: baseY } = getPastePosition();
      /* If system clipboard has content, paste only that; otherwise paste app clipboard. */
      if (hasImage || hasText) {
        const importItems: ImportImageOptionsItem[] = [];
        let nextY = baseY;
        for (const item of items) {
          if (!item.type.startsWith("image/")) continue;
          const file = item.getAsFile();
          if (file == null) continue;
          importItems.push({ file, worldX: baseX, worldY: nextY });
          nextY += PASTE_OFFSET_Y * 5;
        }
        if (importItems.length > 0) {
          dispatchImportPaste({ type: "SET_PENDING_IMPORT", payload: importItems });
          if (hasText && text != null) {
            dispatchImportPaste({
              type: "SET_PENDING_PASTE",
              payload: { x: baseX, y: nextY, content: text },
            });
          }
          return;
        }
        if (hasText && text != null) {
          const { fontSize, textColor } = getDefaultTextPlacementStyle();
          addTextAtWithContent(baseX, baseY, text, fontSize, textColor);
        }
        return;
      }
      if (hasAppClipboard) {
        const clipboardEntries = clipboardRef.current;
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
          const offsetX = baseX - centerX;
          const offsetY = baseY - centerY;
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
          elementSelection.setSelectedElementIds(newElements.map((el) => el.id));
        }
      }
    };
    document.addEventListener("paste", onPaste, { capture: true });
    return () =>
      document.removeEventListener("paste", onPaste, { capture: true });
  }, [
    editingElementId,
    getPastePosition,
    addTextAtWithContent,
    addImageFromFile,
    setElements,
    elementSelection,
    getDefaultTextPlacementStyle,
  ]);

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
          onCut={handleCutSelected}
          onCopy={handleCopySelected}
          onDuplicate={handleDuplicateSelected}
          onDelete={handleDeleteSelected}
          onGetImageInfo={selectedImageForInfo != null ? handleGetImageInfo : undefined}
          getEffectiveFontSize={getEffectiveFontSize}
          getFillFittedSize={getFillFittedSize}
          onFillModeEnabled={registerFillOnPendingFit}
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
        onContextMenu={handleCanvasContextMenu}
        isPanning={panZoom.isPanning}
        elements={elements}
        editingElementId={editingElementId}
        onElementDoubleClick={(id) =>
          dispatchCanvasUi({ type: "SET_EDITING", payload: id })
        }
        onUpdateElementContent={handleUpdateElementContent}
        onFinishEditElement={handleFinishEditElement}
        onResizeHandleDown={handleResizeHandleDown}
        onResizeHandleMove={handleResizeHandleMove}
        onResizeHandleUp={handleResizeHandleUp}
        onImageNaturalDimensions={handleImageNaturalDimensions}
        onEffectiveFontSize={handleEffectiveFontSize}
        onTextAspectRatio={handleTextAspectRatio}
        onMaxFillBoxSize={handleMaxFillBoxSize}
        onFillFittedSize={handleFillFittedSize}
        getEffectiveFontSize={getEffectiveFontSize}
        isResizing={isResizing}
        toolbarContainerRef={toolbarContainerRef}
        backgroundColor={backgroundColor}
        gridStyle={gridStyle}
      />
      </div>
      <ElementContextMenu
        onCut={handleCutSelected}
        onCopy={handleCopySelected}
        onDuplicate={handleDuplicateSelected}
        onDelete={handleDeleteSelected}
        onSendToBack={handleSendToBack}
        onSendToFront={handleSendToFront}
        onGetImageInfo={selectedImageForInfo != null ? handleGetImageInfo : undefined}
        position={contextMenu?.type === "element" ? { x: contextMenu.x, y: contextMenu.y } : null}
        onClose={() => dispatchCanvasUi({ type: "CLOSE_CONTEXT_MENU" })}
        menuRef={contextMenuRef}
      />
      <ImageInfoDialog
        image={imageInfoDialogImage}
        open={imageInfoDialogElementId != null && imageInfoDialogImage != null}
        onOpenChange={handleImageInfoDialogOpenChange}
        onOptimizeImage={handleOptimizeImage}
        isOptimizing={isOptimizingImage}
      />
      <ImportImageOptionsDialog
        open={pendingImportItems.length > 0}
        onOpenChange={handleImportDialogOpenChange}
        items={pendingImportItems}
        onKeepOriginal={handleImportKeepOriginal}
        onOptimize={handleImportOptimize}
        isOptimizing={isOptimizingImport}
      />
      <CanvasContextMenu
        position={contextMenu?.type === "canvas" ? { x: contextMenu.x, y: contextMenu.y } : null}
        onClose={() => dispatchCanvasUi({ type: "CLOSE_CONTEXT_MENU" })}
        onPaste={handlePaste}
        menuRef={contextMenuRef}
      />
    </WhiteboardErrorBoundary>
  );
}
