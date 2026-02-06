import type { RefObject } from "react";
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useEffect } from "react";
import { clientToViewBox, viewBoxToWorld } from "../../hooks/canvas/canvasCoords";
import type { SelectionRect } from "../../hooks";
import type { WhiteboardElement } from "../../types/whiteboard";
import { type ElementBounds, sanitizeElementBounds } from "../../utils/elementBounds";
import { safeSvgNumber } from "../../utils/safeSvgNumber";
import type { ResizeHandleId } from "../../utils/resizeHandles";
import {
  innerContentIfSingleColorSpan,
  isHtmlContent,
  plainTextToHtml,
  sanitizeHtml,
} from "../../utils/sanitizeHtml";
import { applyFormatToContent, type FormatTag } from "../../utils/textFormat";
import { DotGridPattern, PATTERN_ID } from "../DotGridPattern";
import { ElementSelectionOverlay } from "./ElementSelectionOverlay";
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
  /** When true, skip measurement-driven updates that could conflict with user resize. */
  isResizing?: boolean;
  /** If focus moves into this container (e.g. toolbar), do not end editing on blur. */
  toolbarContainerRef?: RefObject<HTMLElement | null>;
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
    isResizing = false,
    toolbarContainerRef,
  } = props;

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
    let next: Record<string, ElementBounds> = {};
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
      next = {};
      for (const [id, div] of textDivRefs.current) {
      try {
        if (div == null) continue;
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
        if (topLeft !== null && bottomRight !== null) {
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
            Number.isFinite(wl.x) &&
            Number.isFinite(wl.y) &&
            Number.isFinite(w) &&
            Number.isFinite(h) &&
            w > 0 &&
            h > 0
          ) {
            next[id] = sanitizeElementBounds({
              x: wl.x,
              y: wl.y,
              width: w,
              height: h,
            });
          }
        }
      } catch {
        continue;
      }
    }
      onMeasuredBoundsChange(next);
    } catch (err) {
      console.error("[WhiteboardCanvasSvg] measurement effect error", err);
    }
  }, [
    elements,
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
    editingRef.current.innerHTML = html;
    editingRef.current.focus();
  }, [editingElementId, elements]);

  const handleEditKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    id: string
  ) => {
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
  };

  const setTextDivRef = (id: string, el: HTMLDivElement | null): void => {
    if (el) textDivRefs.current.set(id, el);
    else textDivRefs.current.delete(id);
  };

  return (
    <svg
      ref={svgRef}
      className="whiteboard-canvas"
      viewBox={viewBox}
      preserveAspectRatio="none"
    >
      <defs>
        <DotGridPattern />
      </defs>
      <g
        transform={transform}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onContextMenu={onContextMenu}
        style={{ cursor: isPanning ? "grabbing" : "default" }}
      >
        <rect
          x={-CANVAS_EXTENT}
          y={-CANVAS_EXTENT}
          width={CANVAS_EXTENT * 2}
          height={CANVAS_EXTENT * 2}
          fill={`url(#${PATTERN_ID})`}
        />
        {elements.map((el) => {
          if (el.kind !== "text") return null;
          return (
            <WhiteboardTextElement
              key={el.id}
              element={el}
              isEditing={el.id === editingElementId}
              measuredBounds={measuredBounds}
              onDoubleClick={onElementDoubleClick}
              setTextDivRef={setTextDivRef}
              onUpdateContent={onUpdateElementContent}
              onFinishEdit={onFinishEditElement}
              onEditKeyDown={handleEditKeyDown}
              editingRefSetter={(r) => {
                editingRef.current = r;
              }}
              toolbarContainerRef={toolbarContainerRef}
            />
          );
        })}
        <ElementSelectionOverlay
          selectedElementIds={selectedElementIds}
          elements={elements}
          measuredBounds={measuredBounds}
          onResizeHandleDown={onResizeHandleDown}
          onResizeHandleMove={onResizeHandleMove}
          onResizeHandleUp={onResizeHandleUp}
        />
      </g>
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
