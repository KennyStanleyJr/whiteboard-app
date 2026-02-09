import type { RefObject } from "react";
import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useEffect } from "react";
import { clientToViewBox, viewBoxToWorld } from "../../hooks/canvas/canvasCoords";
import type { SelectionRect } from "../../hooks";
import type { WhiteboardElement } from "../../types/whiteboard";
import {
  type ElementBounds,
  boundsEqualWithinEpsilon,
  sanitizeElementBounds,
} from "../../lib/elementBounds";
import { safeSvgNumber } from "../../lib/safeSvgNumber";
import type { ResizeHandleId } from "../../lib/resizeHandles";
import {
  innerContentIfSingleColorSpan,
  isHtmlContent,
  plainTextToHtml,
  sanitizeHtml,
} from "../../lib/sanitizeHtml";
import { applyFormatToContent, type FormatTag } from "../../lib/textFormat";
import type { GridStyle } from "../../lib/canvasPreferences";
import { getContrastingGridColor } from "../../lib/contrastColor";
import {
  DotGridPattern,
  LineGridPattern,
  LINE_PATTERN_ID,
  NotebookGridPattern,
  NOTEBOOK_PATTERN_ID,
  PATTERN_ID,
} from "../grid";
import { ElementSelectionOverlay } from "./ElementSelectionOverlay";
import { WhiteboardImageElement } from "./WhiteboardImageElement";
import { WhiteboardShapeElement } from "./WhiteboardShapeElement";
import { WhiteboardTextElement } from "./WhiteboardTextElement";

const CANVAS_EXTENT = 500000;

export interface WhiteboardCanvasSvgProps {
  panX: number;
  panY: number;
  zoom: number;
  width: number;
  height: number;
  selectionRect: SelectionRect | null;
  selectedElementIds: string[];
  measuredBounds: Record<string, ElementBounds>;
  onMeasuredBoundsChange: (bounds: Record<string, ElementBounds>) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  isPanning: boolean;
  elements: WhiteboardElement[];
  editingElementId: string | null;
  onElementDoubleClick: (id: string) => void;
  onUpdateElementContent: (id: string, content: string) => void;
  onFinishEditElement: () => void;
  onResizeHandleDown?: (handleId: ResizeHandleId, e: React.PointerEvent) => void;
  onResizeHandleMove?: (e: React.PointerEvent) => void;
  onResizeHandleUp?: (e: React.PointerEvent) => void;
  onImageNaturalDimensions?: (
    elementId: string,
    naturalWidth: number,
    naturalHeight: number
  ) => void;
  /** When true, skip measurement-driven updates that could conflict with user resize. */
  isResizing?: boolean;
  /** Live bounds during resize; overrides element/measured bounds so selection box tracks resize. */
  liveResizeBounds?: { elementId: string; bounds: ElementBounds } | null;
  /** If focus moves into this container (e.g. toolbar), do not end editing on blur. */
  toolbarContainerRef?: RefObject<HTMLElement | null>;
  /** Canvas background fill color. */
  backgroundColor?: string;
  /** Grid style: empty, dotted, or lined. */
  gridStyle?: GridStyle;
  /** When a text element in fill mode reports its effective fontSize (for baking when fill is turned off). */
  onEffectiveFontSize?: (elementId: string, effectiveFontSize: number) => void;
  /** When a text element in fill mode reports its content aspect ratio (for locked resize). */
  onTextAspectRatio?: (elementId: string, aspectRatio: number) => void;
  /** When a text element in fill mode reports max box size (resize is capped to this). */
  onMaxFillBoxSize?: (elementId: string, maxWidth: number, maxHeight: number) => void;
  /** When in fill mode, report fitted box size (for baking on fill off). */
  onFillFittedSize?: (elementId: string, width: number, height: number) => void;
  /** Returns last reported effective fontSize for a text in fill mode (so editor can match display size). */
  getEffectiveFontSize?: (elementId: string) => number | undefined;
}

export interface WhiteboardCanvasSvgHandle {
  /** Apply bold/italic/underline to the whole editor content (no selection). */
  applyFormatToEditingElement: (tag: FormatTag) => void;
  /** Apply text color to the whole editor content. */
  applyColorToEditorWithoutFocus: (color: string) => void;
}

export const WhiteboardCanvasSvg = forwardRef<
  WhiteboardCanvasSvgHandle,
  WhiteboardCanvasSvgProps
>(function WhiteboardCanvasSvg(props, ref): JSX.Element {
  const {
    panX,
    panY,
    zoom,
    width,
    height,
    selectionRect,
    selectedElementIds,
    measuredBounds,
    onMeasuredBoundsChange,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onContextMenu,
    isPanning,
    elements,
    editingElementId,
    onElementDoubleClick,
    onUpdateElementContent,
    onFinishEditElement,
    onResizeHandleDown,
    onResizeHandleMove,
    onResizeHandleUp,
    onImageNaturalDimensions,
    isResizing = false,
    liveResizeBounds,
    toolbarContainerRef,
    backgroundColor = "#ffffff",
    gridStyle = "dotted",
    onEffectiveFontSize,
    onTextAspectRatio,
    onMaxFillBoxSize,
    onFillFittedSize,
    getEffectiveFontSize,
  } = props;

  const gridColor = getContrastingGridColor(backgroundColor);

  const transform = `translate(${panX}, ${panY}) scale(${zoom})`;
  const viewBox = `0 0 ${width} ${height}`;
  const editingRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const textDivRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  useImperativeHandle(
    ref,
    () => ({
      applyFormatToEditingElement(tag: FormatTag): void {
        const editor = editingRef.current;
        if (editor == null || editingElementId == null) return;
        const raw = editor.innerHTML ?? "";
        const sanitized = sanitizeHtml(raw);
        const content = applyFormatToContent(sanitized, tag);
        editor.innerHTML = content;
        onUpdateElementContent(editingElementId, content);
      },
      applyColorToEditorWithoutFocus(color: string): void {
        const editor = editingRef.current;
        if (editor == null || editingElementId == null) return;
        const raw = editor.innerHTML ?? "";
        const inner = innerContentIfSingleColorSpan(raw);
        const trimmed = inner.trim() || " ";
        const wrapped = `<span style="color: ${color}">${trimmed}</span>`;
        const content = sanitizeHtml(wrapped);
        editor.innerHTML = content;
        onUpdateElementContent(editingElementId, content);
      },
    }),
    [editingElementId, onUpdateElementContent]
  );

  useLayoutEffect(() => {
    const next: Record<string, ElementBounds> = {};
    try {
      const svgEl = svgRef.current;
      if (
        svgEl == null ||
        width <= 0 ||
        height <= 0 ||
        !Number.isFinite(zoom) ||
        zoom <= 0
      )
        return;
      for (const [id, div] of textDivRefs.current) {
      try {
        if (div == null) continue;
        const el = elements.find((e) => e.id === id);
        const hasExplicitSize =
          el?.kind === "text" &&
          el.width != null &&
          el.height != null &&
          el.width > 0 &&
          el.height > 0;
        if (hasExplicitSize) continue;
        const rect = div.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const topLeft = clientToViewBox(
          svgEl,
          rect.left,
          rect.top,
          width,
          height
        );
        const bottomRight = clientToViewBox(
          svgEl,
          rect.right,
          rect.bottom,
          width,
          height
        );
        if (topLeft !== null && bottomRight !== null && el != null) {
          const wl = viewBoxToWorld(
            topLeft.x,
            topLeft.y,
            panX,
            panY,
            zoom
          );
          const br = viewBoxToWorld(
            bottomRight.x,
            bottomRight.y,
            panX,
            panY,
            zoom
          );
          const w = br.x - wl.x;
          const h = br.y - wl.y;
          if (
            Number.isFinite(w) &&
            Number.isFinite(h) &&
            w > 0 &&
            h > 0
          ) {
            /* Use rounded element position and dimensions so selection/FO stay aligned; round all to reduce jitter and match foreignObject. */
            next[id] = sanitizeElementBounds({
              x: Math.round(el.x),
              y: Math.round(el.y),
              width: Math.round(w),
              height: Math.round(h),
            });
          }
        }
      } catch {
        continue;
      }
    }
      if (Object.keys(next).length > 0) {
        const changed: Record<string, ElementBounds> = {};
        for (const [id, b] of Object.entries(next)) {
          const existing = measuredBounds[id];
          if (existing == null || !boundsEqualWithinEpsilon(b, existing)) {
            changed[id] = b;
          }
        }
        if (Object.keys(changed).length > 0) {
          onMeasuredBoundsChange(changed);
        }
      }
    } catch (err) {
      console.error("[WhiteboardCanvasSvg] measurement effect error", err);
    }
  }, [
    elements,
    measuredBounds,
    panX,
    panY,
    zoom,
    width,
    height,
    isResizing,
    onMeasuredBoundsChange,
  ]);

  useEffect(() => {
    if (editingElementId == null || !editingRef.current) return;
    const el = elements.find(
      (e) => e.id === editingElementId && e.kind === "text"
    );
    if (!el || el.kind !== "text") return;
    const textEl = el;
    const html = isHtmlContent(textEl.content)
      ? sanitizeHtml(textEl.content)
      : plainTextToHtml(textEl.content);
    const editor = editingRef.current;
    editor.innerHTML = html;
    editor.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(editor);
      sel.addRange(range);
    }
  }, [editingElementId, elements]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, id: string) => {
      if (e.key === "Escape") {
        e.preventDefault();
        const editor = editingRef.current;
        if (editor) {
          const raw = editor.innerHTML ?? "";
          const content = sanitizeHtml(raw);
          onUpdateElementContent(id, content);
        }
        onFinishEditElement();
      }
      // Enter: allow default (insert newline in contentEditable)
    },
    [onUpdateElementContent, onFinishEditElement]
  );

  const setTextDivRef = useCallback((id: string, el: HTMLDivElement | null): void => {
    if (el) textDivRefs.current.set(id, el);
    else textDivRefs.current.delete(id);
  }, []);

  const setEditingRef = useCallback((el: HTMLDivElement | null): void => {
    editingRef.current = el;
  }, []);

  return (
    <svg
      ref={svgRef}
      className="whiteboard-canvas"
      viewBox={viewBox}
      preserveAspectRatio="none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
      style={{ cursor: isPanning ? "grabbing" : "default" }}
    >
      <defs>
        <DotGridPattern color={gridStyle === "dotted" ? gridColor : undefined} />
        <LineGridPattern color={gridColor} />
        <NotebookGridPattern color={gridColor} />
      </defs>
      <g transform={transform}>
        <rect
          x={-CANVAS_EXTENT}
          y={-CANVAS_EXTENT}
          width={CANVAS_EXTENT * 2}
          height={CANVAS_EXTENT * 2}
          fill={backgroundColor}
        />
        {gridStyle !== "empty" && (
          <rect
            x={-CANVAS_EXTENT}
            y={-CANVAS_EXTENT}
            width={CANVAS_EXTENT * 2}
            height={CANVAS_EXTENT * 2}
            fill={
              gridStyle === "dotted"
                ? `url(#${PATTERN_ID})`
                : gridStyle === "lined"
                  ? `url(#${NOTEBOOK_PATTERN_ID})`
                  : `url(#${LINE_PATTERN_ID})`
            }
          />
        )}
      </g>
      {/* Single pass in viewBox space so DOM order = array order (Send to Back/Front, Ctrl+[/] work). */}
      {elements.map((el) => {
        if (el.kind === "shape") {
          return (
            <WhiteboardShapeElement
              key={el.id}
              element={el}
              viewBoxTransform={{ panX, panY, zoom }}
            />
          );
        }
        if (el.kind === "image") {
          return (
            <WhiteboardImageElement
              key={el.id}
              element={el}
              onNaturalDimensions={onImageNaturalDimensions}
              viewBoxTransform={{ panX, panY, zoom }}
            />
          );
        }
        if (el.kind === "text") {
          return (
            <WhiteboardTextElement
              key={el.id}
              element={el}
              isEditing={el.id === editingElementId}
              isResizing={isResizing}
              measuredBounds={measuredBounds}
              onDoubleClick={onElementDoubleClick}
              setTextDivRef={setTextDivRef}
              onUpdateContent={onUpdateElementContent}
              onFinishEdit={onFinishEditElement}
              onEditKeyDown={handleEditKeyDown}
              editingRefSetter={setEditingRef}
              toolbarContainerRef={toolbarContainerRef}
              onEffectiveFontSize={onEffectiveFontSize}
              onTextAspectRatio={onTextAspectRatio}
              onMaxFillBoxSize={onMaxFillBoxSize}
              onFillFittedSize={onFillFittedSize}
              getEffectiveFontSize={getEffectiveFontSize}
              viewBoxTransform={{ panX, panY, zoom }}
            />
          );
        }
        return null;
      })}
      <ElementSelectionOverlay
        selectedElementIds={selectedElementIds}
        elements={elements}
        measuredBounds={measuredBounds}
        liveResizeBounds={liveResizeBounds}
        zoom={zoom}
        viewBoxTransform={{ panX, panY, zoom }}
        onResizeHandleDown={onResizeHandleDown}
        onResizeHandleMove={onResizeHandleMove}
        onResizeHandleUp={onResizeHandleUp}
      />
      {selectionRect !== null && (
        <rect
          className="selection-box"
          x={safeSvgNumber(selectionRect.x, 0)}
          y={safeSvgNumber(selectionRect.y, 0)}
          width={safeSvgNumber(selectionRect.width, 1)}
          height={safeSvgNumber(selectionRect.height, 1)}
          fill="rgba(0, 120, 215, 0.1)"
          stroke="rgba(0, 120, 215, 0.8)"
          strokeWidth={1.5}
          pointerEvents="none"
        />
      )}
    </svg>
  );
});
