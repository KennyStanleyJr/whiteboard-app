/**
 * Renders text elements as positioned HTML divs on Safari/iOS.
 * Avoids foreignObject which breaks after pan/zoom (WebKit bug 23113).
 */
import type { RefObject } from "react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import { clientToViewBox, viewBoxToWorld } from "../../hooks/canvas/canvasCoords";
import { type ElementBounds, sanitizeElementBounds } from "../../lib/elementBounds";
import {
  DEFAULT_UNMEASURED_TEXT_HEIGHT,
  DEFAULT_UNMEASURED_TEXT_WIDTH,
  TEXT_EDIT_HEIGHT,
  TEXT_EDIT_WIDTH,
} from "../../lib/elementBounds";
import { isHtmlContent, sanitizeHtml } from "../../lib/sanitizeHtml";
import type { TextElement } from "../../types/whiteboard";
import { verticalAlignToJustifyContent } from "./verticalAlign";

const MIN_SIZE = 1;

function getTextContentProps(content: string) {
  return isHtmlContent(content)
    ? { dangerouslySetInnerHTML: { __html: sanitizeHtml(content) } }
    : { children: content };
}

export interface SafariTextOverlayProps {
  svgRef: RefObject<SVGSVGElement | null>;
  textElements: TextElement[];
  editingElementId: string | null;
  measuredBounds: Record<string, ElementBounds>;
  panX: number;
  panY: number;
  zoom: number;
  width: number;
  height: number;
  onDoubleClick: (id: string) => void;
  onUpdateContent: (id: string, content: string) => void;
  onFinishEdit: () => void;
  onEditKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, id: string) => void;
  onMeasuredBoundsChange: (bounds: Record<string, ElementBounds>) => void;
  setTextDivRef: (id: string, el: HTMLDivElement | null) => void;
  editingRefSetter: (el: HTMLDivElement | null) => void;
  toolbarContainerRef?: RefObject<HTMLElement | null>;
}

function getTextBounds(
  el: TextElement,
  measured: ElementBounds | undefined,
  isEditing: boolean
): { w: number; h: number } {
  const hasSize = el.width != null && el.height != null && el.width > 0 && el.height > 0;
  if (hasSize) {
    return {
      w: Math.max(MIN_SIZE, el.width!),
      h: Math.max(MIN_SIZE, el.height!),
    };
  }
  if (measured != null) {
    return { w: Math.max(measured.width, MIN_SIZE), h: Math.max(measured.height, MIN_SIZE) };
  }
  return isEditing
    ? { w: TEXT_EDIT_WIDTH, h: TEXT_EDIT_HEIGHT }
    : { w: DEFAULT_UNMEASURED_TEXT_WIDTH, h: DEFAULT_UNMEASURED_TEXT_HEIGHT };
}

export function SafariTextOverlay({
  svgRef,
  textElements,
  editingElementId,
  measuredBounds,
  panX,
  panY,
  zoom,
  width,
  height,
  onDoubleClick,
  onUpdateContent,
  onFinishEdit,
  onEditKeyDown,
  onMeasuredBoundsChange,
  setTextDivRef,
  editingRefSetter,
  toolbarContainerRef,
}: SafariTextOverlayProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const textDivRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const setRef = useCallback(
    (id: string, el: HTMLDivElement | null) => {
      if (el) textDivRefs.current.set(id, el);
      else textDivRefs.current.delete(id);
      setTextDivRef(id, el);
    },
    [setTextDivRef]
  );

  const layoutAffectingKey = textElements
    .map(
      (e) =>
        `${e.id}|${e.x}|${e.y}|${e.content}|${e.fontSize ?? 24}|${e.width ?? ""}|${e.height ?? ""}`
    )
    .sort()
    .join(";;");
  const lastReportedRef = useRef<string>("");

  useLayoutEffect(() => {
    const svgEl = svgRef.current;
    if (svgEl == null || width <= 0 || height <= 0 || !Number.isFinite(zoom) || zoom <= 0) return;
    const next: Record<string, ElementBounds> = {};
    for (const [id, div] of textDivRefs.current) {
      try {
        if (div == null) continue;
        const rect = div.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const topLeft = clientToViewBox(svgEl, rect.left, rect.top, width, height);
        const bottomRight = clientToViewBox(svgEl, rect.right, rect.bottom, width, height);
        if (topLeft == null || bottomRight == null) continue;
        const wl = viewBoxToWorld(topLeft.x, topLeft.y, panX, panY, zoom);
        const br = viewBoxToWorld(bottomRight.x, bottomRight.y, panX, panY, zoom);
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
          next[id] = sanitizeElementBounds({ x: wl.x, y: wl.y, width: w, height: h });
        }
      } catch {
        continue;
      }
    }
    const sortedIds = Object.keys(next).sort();
    const key = sortedIds.map((id) => `${id}:${JSON.stringify(next[id])}`).join("|");
    if (key !== lastReportedRef.current) {
      lastReportedRef.current = key;
      onMeasuredBoundsChange(next);
    }
  }, [
    layoutAffectingKey,
    panX,
    panY,
    zoom,
    width,
    height,
    svgRef,
    onMeasuredBoundsChange,
  ]);

  if (textElements.length === 0) {
    return <div ref={containerRef} className="safari-text-overlay" aria-hidden />;
  }

  const svgEl = svgRef.current;
  const svgRect = svgEl?.getBoundingClientRect();

  const scaleX = svgRect && width > 0 ? svgRect.width / width : 1;
  const scaleY = svgRect && height > 0 ? svgRect.height / height : 1;

  return (
    <div
      ref={containerRef}
      className="safari-text-overlay"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
      aria-hidden
    >
      {textElements.map((el) => {
        const isEditing = el.id === editingElementId;
        const { w: wWorld, h: hWorld } = getTextBounds(el, measuredBounds[el.id], isEditing);

        const viewX = el.x * zoom + panX;
        const viewY = el.y * zoom + panY;
        const viewW = wWorld * zoom;
        const viewH = hWorld * zoom;

        const left = viewX * scaleX;
        const top = viewY * scaleY;
        const cssW = viewW * scaleX;
        const cssH = viewH * scaleY;

        const justifyContent = verticalAlignToJustifyContent(el.textVerticalAlign);
        const textWhiteSpace = isHtmlContent(el.content) ? "normal" : "pre-wrap";
        const baseStyle: React.CSSProperties = {
          display: "flex",
          flexDirection: "column",
          justifyContent,
          minHeight: 0,
          fontSize: `${el.fontSize ?? 24}px`,
          lineHeight: 1.2,
          textAlign: (el.textAlign ?? "left") as "left" | "center" | "right",
          color: "#000000",
          whiteSpace: textWhiteSpace,
        };
        const contentProps = getTextContentProps(el.content);

        const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
          const raw = e.currentTarget.innerHTML ?? "";
          onUpdateContent(el.id, sanitizeHtml(raw));
          const next = e.relatedTarget as Node | null;
          if (next == null || !toolbarContainerRef?.current?.contains(next)) onFinishEdit();
        };

        return (
          <div
            key={el.id}
            style={{
              position: "absolute",
              left: `${left}px`,
              top: `${top}px`,
              width: `${Math.max(1, cssW)}px`,
              height: `${Math.max(1, cssH)}px`,
              pointerEvents: "auto",
              boxSizing: "border-box",
              padding: 2,
              overflow: "hidden",
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onDoubleClick(el.id);
            }}
          >
            {isEditing ? (
              <div
                ref={(r) => {
                  editingRefSetter(r);
                  setRef(el.id, r);
                }}
                className="whiteboard-text-display"
                contentEditable
                suppressContentEditableWarning
                style={{ ...baseStyle, width: "100%", height: "100%" }}
                onBlur={handleBlur}
                onKeyDown={(e) => onEditKeyDown(e, el.id)}
                aria-label="Edit text"
              />
            ) : (
              <div
                ref={(r) => setRef(el.id, r)}
                className="whiteboard-text-display whiteboard-text-display--sized"
                style={{
                  ...baseStyle,
                  width: "100%",
                  height: "100%",
                  overflowWrap: "break-word",
                  overflow: "hidden",
                }}
                {...contentProps}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
