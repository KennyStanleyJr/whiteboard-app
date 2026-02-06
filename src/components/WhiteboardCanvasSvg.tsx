import { useLayoutEffect, useRef, useEffect } from "react";
import { clientToViewBox, viewBoxToWorld } from "../hooks/canvas/canvasCoords";
import type { SelectionRect } from "../hooks";
import type { TextVerticalAlign, WhiteboardElement } from "../types/whiteboard";
import {
  getElementBounds,
  type ElementBounds,
  sanitizeElementBounds,
  TEXT_EDIT_HEIGHT,
  TEXT_EDIT_WIDTH,
} from "../utils/elementBounds";
import { safeSvgNumber } from "../utils/safeSvgNumber";
import {
  RESIZE_HANDLE_CURSORS,
  RESIZE_HANDLE_IDS,
  type ResizeHandleId,
} from "../utils/resizeHandles";
import {
  isHtmlContent,
  plainTextToHtml,
  sanitizeHtml,
} from "../utils/sanitizeHtml";
import { DotGridPattern, PATTERN_ID } from "./DotGridPattern";

const CANVAS_EXTENT = 500000;
/** Padding around the element selection box (world units). */
const SELECTION_BOX_PADDING = 4;
/** Minimum foreignObject width/height when using measured bounds (avoid 0). */
const MIN_FOREIGN_OBJECT_SIZE = 1;
/** Resize handle size in world units. */
const RESIZE_HANDLE_SIZE = 8;

function verticalAlignToJustifyContent(
  va: TextVerticalAlign | undefined
): "flex-start" | "center" | "flex-end" {
  switch (va ?? "top") {
    case "top":
      return "flex-start";
    case "middle":
      return "center";
    case "bottom":
      return "flex-end";
  }
}

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
}

export function WhiteboardCanvasSvg(props: WhiteboardCanvasSvgProps): JSX.Element {
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
  } = props;

  const transform = `translate(${panX}, ${panY}) scale(${zoom})`;
  const viewBox = `0 0 ${width} ${height}`;
  const editingRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const textDivRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

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
          const isEditing = el.id === editingElementId;
          const hasExplicitSize =
            el.width !== undefined &&
            el.height !== undefined &&
            el.width > 0 &&
            el.height > 0;
          const measured = measuredBounds[el.id];
          const foWidth = hasExplicitSize
            ? Math.max(MIN_FOREIGN_OBJECT_SIZE, el.width!)
            : measured !== undefined
              ? Math.max(measured.width, MIN_FOREIGN_OBJECT_SIZE)
              : isEditing
                ? TEXT_EDIT_WIDTH
                : MIN_FOREIGN_OBJECT_SIZE;
          const foHeight = hasExplicitSize
            ? Math.max(MIN_FOREIGN_OBJECT_SIZE, el.height!)
            : measured !== undefined
              ? Math.max(measured.height, MIN_FOREIGN_OBJECT_SIZE)
              : isEditing
                ? TEXT_EDIT_HEIGHT
                : MIN_FOREIGN_OBJECT_SIZE;
          return (
            <foreignObject
              key={el.id}
              x={safeSvgNumber(el.x, 0)}
              y={safeSvgNumber(el.y, 0)}
              width={safeSvgNumber(foWidth, MIN_FOREIGN_OBJECT_SIZE)}
              height={safeSvgNumber(foHeight, MIN_FOREIGN_OBJECT_SIZE)}
              className="whiteboard-text-edit"
              onDoubleClick={
                isEditing
                  ? undefined
                  : (e) => {
                      e.stopPropagation();
                      onElementDoubleClick(el.id);
                    }
              }
            >
              {isEditing ? (
                <div
                  ref={(r) => {
                    editingRef.current = r;
                    setTextDivRef(el.id, r);
                  }}
                  className="whiteboard-text-display"
                  contentEditable
                  suppressContentEditableWarning={true}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: verticalAlignToJustifyContent(el.textVerticalAlign),
                    minHeight: 0,
                    padding: 2,
                    textAlign: el.textAlign ?? "left",
                    fontSize: `${el.fontSize ?? 16}${el.fontSizeUnit ?? "px"}`,
                    lineHeight: 1.2,
                  }}
                  onBlur={(e) => {
                    const raw = e.currentTarget.innerHTML ?? "";
                    const content = sanitizeHtml(raw);
                    onUpdateElementContent(el.id, content);
                    onFinishEditElement();
                  }}
                  onKeyDown={(e) => handleEditKeyDown(e, el.id)}
                  aria-label="Edit text"
                />
              ) : hasExplicitSize ? (
                <div
                  ref={(r) => setTextDivRef(el.id, r)}
                  className="whiteboard-text-display whiteboard-text-display--sized"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: verticalAlignToJustifyContent(el.textVerticalAlign),
                    minHeight: 0,
                    fontSize: `${el.fontSize ?? 16}${el.fontSizeUnit ?? "px"}`,
                    lineHeight: 1.2,
                    whiteSpace: isHtmlContent(el.content) ? "normal" : "pre-wrap",
                    wordBreak: "break-word",
                    overflow: "hidden",
                    width: "100%",
                    height: "100%",
                    textAlign: el.textAlign ?? "left",
                  }}
                  {...(isHtmlContent(el.content)
                    ? {
                        dangerouslySetInnerHTML: {
                          __html: sanitizeHtml(el.content),
                        },
                      }
                    : { children: el.content })}
                />
              ) : (
                <div
                  ref={(r) => setTextDivRef(el.id, r)}
                  className="whiteboard-text-display whiteboard-text-display--fit"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: verticalAlignToJustifyContent(el.textVerticalAlign),
                    minHeight: 0,
                    fontSize: `${el.fontSize ?? 16}${el.fontSizeUnit ?? "px"}`,
                    lineHeight: 1.2,
                    textAlign: el.textAlign ?? "left",
                    whiteSpace: isHtmlContent(el.content) ? "normal" : "pre-wrap",
                  }}
                  {...(isHtmlContent(el.content)
                    ? {
                        dangerouslySetInnerHTML: {
                          __html: sanitizeHtml(el.content),
                        },
                      }
                    : { children: el.content })}
                />
              )}
            </foreignObject>
          );
        })}
        {selectedElementIds.map((id) => {
          const el = elements.find((e) => e.id === id);
          if (el == null) return null;
          const hasExplicitSize =
            el.kind === "text" &&
            el.width != null &&
            el.height != null &&
            el.width > 0 &&
            el.height > 0;
          const rawBounds = hasExplicitSize
            ? getElementBounds(el, measuredBounds)
            : measuredBounds[id] ?? getElementBounds(el, measuredBounds);
          const b = sanitizeElementBounds(rawBounds);
          const sx = safeSvgNumber(b.x - SELECTION_BOX_PADDING, 0);
          const sy = safeSvgNumber(b.y - SELECTION_BOX_PADDING, 0);
          const sw = safeSvgNumber(
            Math.max(1, b.width + 2 * SELECTION_BOX_PADDING),
            1
          );
          const sh = safeSvgNumber(
            Math.max(1, b.height + 2 * SELECTION_BOX_PADDING),
            1
          );
          const hs = RESIZE_HANDLE_SIZE / 2;
          const showHandles =
            selectedElementIds.length === 1 &&
            selectedElementIds[0] === id &&
            onResizeHandleDown != null &&
            onResizeHandleMove != null &&
            onResizeHandleUp != null;
          return (
            <g key={`selection-${id}`}>
              <rect
                className="element-selection-box"
                x={sx}
                y={sy}
                width={sw}
                height={sh}
                fill="none"
                stroke="rgba(0, 120, 215, 0.8)"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                pointerEvents="none"
              />
              {showHandles &&
                RESIZE_HANDLE_IDS.map((handleId) => {
                  let hx: number;
                  let hy: number;
                  switch (handleId) {
                    case "nw":
                      hx = sx - hs;
                      hy = sy - hs;
                      break;
                    case "n":
                      hx = sx + sw / 2 - hs;
                      hy = sy - hs;
                      break;
                    case "ne":
                      hx = sx + sw - hs;
                      hy = sy - hs;
                      break;
                    case "e":
                      hx = sx + sw - hs;
                      hy = sy + sh / 2 - hs;
                      break;
                    case "se":
                      hx = sx + sw - hs;
                      hy = sy + sh - hs;
                      break;
                    case "s":
                      hx = sx + sw / 2 - hs;
                      hy = sy + sh - hs;
                      break;
                    case "sw":
                      hx = sx - hs;
                      hy = sy + sh - hs;
                      break;
                    case "w":
                      hx = sx - hs;
                      hy = sy + sh / 2 - hs;
                      break;
                  }
                  return (
                    <rect
                      key={handleId}
                      className="resize-handle"
                      x={safeSvgNumber(hx, 0)}
                      y={safeSvgNumber(hy, 0)}
                      width={safeSvgNumber(RESIZE_HANDLE_SIZE, 8)}
                      height={safeSvgNumber(RESIZE_HANDLE_SIZE, 8)}
                      fill="white"
                      stroke="rgba(0, 120, 215, 0.8)"
                      strokeWidth={1.5}
                      style={{ cursor: RESIZE_HANDLE_CURSORS[handleId] }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onResizeHandleDown?.(handleId, e);
                        (e.target as Element).setPointerCapture?.(e.pointerId);
                      }}
                      onPointerMove={onResizeHandleMove}
                      onPointerUp={(e) => {
                        onResizeHandleUp?.(e);
                        (e.target as Element).releasePointerCapture?.(e.pointerId);
                      }}
                      onPointerLeave={(e) => {
                        if ((e.buttons & 1) === 0)
                          (e.target as Element).releasePointerCapture?.(e.pointerId);
                      }}
                    />
                  );
                })}
            </g>
          );
        })}
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
}
