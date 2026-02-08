import type { CSSProperties, RefObject } from "react";
import { memo, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type ElementBounds,
  DEFAULT_UNMEASURED_TEXT_HEIGHT,
  DEFAULT_UNMEASURED_TEXT_WIDTH,
  TEXT_EDIT_HEIGHT,
  TEXT_EDIT_WIDTH,
} from "@/lib/elementBounds";
import { needsForeignObjectTransformWorkaround } from "@/lib/browserUtils";
import { safeSvgNumber } from "@/lib/safeSvgNumber";
import { hasFormat } from "@/lib/textFormat";
import { isHtmlContent, sanitizeHtml } from "@/lib/sanitizeHtml";
import type { TextElement } from "@/types/whiteboard";
import { verticalAlignToJustifyContent } from "./verticalAlign";

const MIN_FOREIGN_OBJECT_SIZE = 1;
const FILL_REFERENCE_FONT_SIZE = 24;
const MAX_FILL_EFFECTIVE_FONT_SIZE = 5000;
const FILL_VERTICAL_NUDGE_PX = 0.25;
/** Scale down when bold (text is ~8% wider). Percentage-based so it works at any font size. */
const FILL_BOLD_SCALE = 0.92;
/** Scale down when italic (text is ~3% wider). */
const FILL_ITALIC_SCALE = 0.97;

const SIZED_WRAPPER_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  overflow: "hidden",
  position: "relative",
};

function getTextContentProps(content: string) {
  return isHtmlContent(content)
    ? { dangerouslySetInnerHTML: { __html: sanitizeHtml(content) } }
    : { children: content };
}

/** Plain text for remeasure trigger; changes when add/remove text, not when only format (b/i/u) toggles. */
function getStructuralContentKey(content: string): string {
  return content.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
}

export interface WhiteboardTextElementProps {
  element: TextElement;
  isEditing: boolean;
  measuredBounds: Record<string, ElementBounds>;
  onDoubleClick: (id: string) => void;
  setTextDivRef: (id: string, el: HTMLDivElement | null) => void;
  onUpdateContent: (id: string, content: string) => void;
  onFinishEdit: () => void;
  onEditKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, id: string) => void;
  editingRefSetter: (el: HTMLDivElement | null) => void;
  toolbarContainerRef?: RefObject<HTMLElement | null>;
  /** When in fill mode, report effective fontSize (base * scale) so toolbar can bake it when turning fill off. */
  onEffectiveFontSize?: (elementId: string, effectiveFontSize: number) => void;
  /** When in fill mode, report text content aspect ratio (width/height) for locked resize. */
  onTextAspectRatio?: (elementId: string, aspectRatio: number) => void;
  /** When in fill mode, report max box size (beyond which text is at max); resize is capped to this. */
  onMaxFillBoxSize?: (elementId: string, maxWidth: number, maxHeight: number) => void;
  /** When in fill mode, report box size that fits current content (for baking on fill off to avoid wrap/shift). */
  onFillFittedSize?: (elementId: string, width: number, height: number) => void;
  /** Returns last reported effective fontSize (so editor in fill mode can match display size). */
  getEffectiveFontSize?: (elementId: string) => number | undefined;
  /** Pan/zoom for Safari foreignObject transform workaround (bug 23113). */
  panX?: number;
  panY?: number;
  zoom?: number;
}

function WhiteboardTextElementInner({
  element: el,
  isEditing,
  measuredBounds,
  onDoubleClick,
  setTextDivRef,
  onUpdateContent,
  onFinishEdit,
  onEditKeyDown,
  editingRefSetter,
  toolbarContainerRef,
  onEffectiveFontSize,
  onTextAspectRatio,
  onMaxFillBoxSize,
  onFillFittedSize,
  getEffectiveFontSize,
  panX = 0,
  panY = 0,
  zoom = 1,
}: WhiteboardTextElementProps): JSX.Element {
  const needsWorkaround = needsForeignObjectTransformWorkaround();
  const foRef = useRef<SVGForeignObjectElement>(null);
  const safariWrapperRef = useRef<HTMLDivElement>(null);
  const hasExplicitSize =
    el.width !== undefined &&
    el.height !== undefined &&
    el.width > 0 &&
    el.height > 0;
  const fillEnabled = el.fill !== false;
  const measured = measuredBounds[el.id];
  const foWidth = hasExplicitSize
    ? Math.max(MIN_FOREIGN_OBJECT_SIZE, el.width!)
    : measured !== undefined
      ? Math.max(measured.width, MIN_FOREIGN_OBJECT_SIZE)
      : isEditing
        ? TEXT_EDIT_WIDTH
        : DEFAULT_UNMEASURED_TEXT_WIDTH;
  const foHeight = hasExplicitSize
    ? Math.max(MIN_FOREIGN_OBJECT_SIZE, el.height!)
    : measured !== undefined
      ? Math.max(measured.height, MIN_FOREIGN_OBJECT_SIZE)
      : isEditing
        ? TEXT_EDIT_HEIGHT
        : DEFAULT_UNMEASURED_TEXT_HEIGHT;

  useLayoutEffect(() => {
    if (!needsWorkaround) return;
    const fo = foRef.current;
    const wrapper = safariWrapperRef.current;
    if (fo == null || wrapper == null) return;
    const ctm = fo.getScreenCTM();
    if (ctm == null) return;
    wrapper.style.transform = `matrix(${ctm.a}, ${ctm.b}, ${ctm.c}, ${ctm.d}, ${ctm.e}, ${ctm.f})`;
    wrapper.style.transformOrigin = "0 0";
  }, [
    needsWorkaround,
    panX,
    panY,
    zoom,
    el.x,
    el.y,
    el.id,
    foWidth,
    foHeight,
  ]);

  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [measureContainerReady, setMeasureContainerReady] = useState(false);
  const fillMeasureRef = useRef<HTMLDivElement | null>(null);
  const fillContainerRef = useRef<HTMLDivElement | null>(null);
  const measurePortalContainerRef = useRef<HTMLDivElement | null>(null);
  const fillEditContainerRef = useRef<HTMLDivElement | null>(null);
  const fillEditEditorRef = useRef<HTMLDivElement | null>(null);
  const [editorScale, setEditorScale] = useState(1);

  const canMeasureFill = hasExplicitSize || measured !== undefined;
  const needMeasure =
    canMeasureFill &&
    fillEnabled &&
    !isEditing &&
    naturalSize === null;

  useLayoutEffect(() => {
    if (!canMeasureFill || !fillEnabled || isEditing) {
      if (measurePortalContainerRef.current != null) {
        measurePortalContainerRef.current.remove();
        measurePortalContainerRef.current = null;
        setMeasureContainerReady(false);
      }
      setNaturalSize(null);
      return;
    }
    if (measurePortalContainerRef.current != null) return;
    const div = document.createElement("div");
    div.setAttribute("aria-hidden", "true");
    div.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;clip-path:inset(100%);pointer-events:none;visibility:hidden;";
    document.body.appendChild(div);
    measurePortalContainerRef.current = div;
    setMeasureContainerReady(true);
    return () => {
      if (measurePortalContainerRef.current != null) {
        measurePortalContainerRef.current.remove();
        measurePortalContainerRef.current = null;
        setMeasureContainerReady(false);
      }
    };
  }, [canMeasureFill, fillEnabled, isEditing]);

  useLayoutEffect(() => {
    if (
      !canMeasureFill ||
      !fillEnabled ||
      isEditing ||
      fillMeasureRef.current == null
    ) {
      if (!canMeasureFill || !fillEnabled || isEditing) {
        setNaturalSize(null);
      }
      return;
    }
    const div = fillMeasureRef.current;
    const w = div.scrollWidth;
    const h = div.scrollHeight;
    if (w > 0 && h > 0) {
      setNaturalSize({ width: w, height: h });
    } else {
      setNaturalSize(null);
    }
  }, [
    canMeasureFill,
    fillEnabled,
    isEditing,
    measureContainerReady,
    el.content,
    el.fontSize,
    foWidth,
    foHeight,
  ]);

  const prevStructuralKeyRef = useRef<string>(getStructuralContentKey(el.content));
  const prevFontSizeRef = useRef<number | undefined>(el.fontSize);
  useLayoutEffect(() => {
    const structuralKey = getStructuralContentKey(el.content);
    if (
      prevStructuralKeyRef.current !== structuralKey ||
      prevFontSizeRef.current !== el.fontSize
    ) {
      prevStructuralKeyRef.current = structuralKey;
      prevFontSizeRef.current = el.fontSize;
      setNaturalSize(null);
    }
  }, [el.content, el.fontSize]);

  useLayoutEffect(() => {
    if (
      !canMeasureFill ||
      !fillEnabled ||
      isEditing ||
      fillContainerRef.current == null
    ) {
      setContainerSize(null);
      return;
    }
    const containerEl = fillContainerRef.current;
    const onResize = (): void => {
      const w = containerEl.clientWidth;
      const h = containerEl.clientHeight;
      if (w > 0 && h > 0) {
        setContainerSize({ width: w, height: h });
      } else {
        setContainerSize(null);
      }
    };
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, [canMeasureFill, fillEnabled, isEditing]);

  const updateEditorScale = useRef(() => {
    const container = fillEditContainerRef.current;
    const editor = fillEditEditorRef.current;
    if (container == null || editor == null) return;
    const cW = container.clientWidth;
    const cH = container.clientHeight;
    const eW = editor.scrollWidth;
    const eH = editor.scrollHeight;
    if (cW <= 0 || cH <= 0) return;
    const scale =
      eW > 0 && eH > 0
        ? Math.min(1, cW / eW, cH / eH)
        : 1;
    setEditorScale(scale);
  });

  useLayoutEffect(() => {
    if (!isEditing || !fillEnabled || !canMeasureFill) {
      setEditorScale(1);
      return;
    }
    const container = fillEditContainerRef.current;
    const editor = fillEditEditorRef.current;
    if (container == null || editor == null) return;
    updateEditorScale.current();
    const ro = new ResizeObserver(() => {
      updateEditorScale.current();
    });
    ro.observe(container);
    ro.observe(editor);
    return () => ro.disconnect();
  }, [isEditing, fillEnabled, canMeasureFill]);

  /* In fill mode with size (explicit or measured), use dimensions so scale updates when canvas resizes the box. */
  const boxW =
    canMeasureFill && fillEnabled
      ? foWidth
      : (containerSize?.width ?? foWidth);
  const boxH =
    canMeasureFill && fillEnabled
      ? foHeight
      : (containerSize?.height ?? foHeight);
  const hasValidNaturalSize =
    naturalSize != null &&
    naturalSize.width > 0 &&
    naturalSize.height > 0;
  const fillScaleCap = MAX_FILL_EFFECTIVE_FONT_SIZE / FILL_REFERENCE_FONT_SIZE;
  const fillScale =
    fillEnabled &&
    canMeasureFill &&
    hasValidNaturalSize &&
    boxW > 0 &&
    boxH > 0
      ? Math.min(
          boxW / naturalSize.width,
          boxH / naturalSize.height,
          fillScaleCap
        )
      : null;
  const fillFormatScale =
    fillScale != null
      ? (hasFormat(el.content, "b") ? FILL_BOLD_SCALE : 1) *
        (hasFormat(el.content, "i") ? FILL_ITALIC_SCALE : 1)
      : 1;

  useLayoutEffect(() => {
    if (fillScale != null && onEffectiveFontSize != null) {
      const effective = Math.round(
        FILL_REFERENCE_FONT_SIZE * fillScale * fillFormatScale
      );
      onEffectiveFontSize(el.id, effective);
    }
  }, [el.id, fillScale, fillFormatScale, onEffectiveFontSize]);

  useLayoutEffect(() => {
    if (
      fillEnabled &&
      canMeasureFill &&
      hasValidNaturalSize &&
      onTextAspectRatio != null
    ) {
      onTextAspectRatio(el.id, naturalSize.width / naturalSize.height);
    }
  }, [
    el.id,
    fillEnabled,
    canMeasureFill,
    hasValidNaturalSize,
    naturalSize,
    onTextAspectRatio,
  ]);

  useLayoutEffect(() => {
    if (
      fillEnabled &&
      canMeasureFill &&
      hasValidNaturalSize &&
      onMaxFillBoxSize != null
    ) {
      const maxW = naturalSize.width * fillScaleCap;
      const maxH = naturalSize.height * fillScaleCap;
      onMaxFillBoxSize(el.id, maxW, maxH);
    }
  }, [
    el.id,
    fillEnabled,
    canMeasureFill,
    hasValidNaturalSize,
    naturalSize,
    fillScaleCap,
    onMaxFillBoxSize,
  ]);

  useLayoutEffect(() => {
    if (
      fillScale != null &&
      hasValidNaturalSize &&
      onFillFittedSize != null
    ) {
      // Report exact content size at fill scale so fill-off uses the same box (no wrap/shift).
      const w = naturalSize.width * fillScale;
      const h = naturalSize.height * fillScale;
      onFillFittedSize(el.id, Math.ceil(w), Math.ceil(h));
    }
  }, [el.id, fillScale, hasValidNaturalSize, naturalSize, onFillFittedSize]);

  const justifyContent = verticalAlignToJustifyContent(el.textVerticalAlign);
  const editorFontSize =
    fillEnabled &&
    canMeasureFill &&
    getEffectiveFontSize != null &&
    getEffectiveFontSize(el.id) != null
      ? getEffectiveFontSize(el.id)!
      : el.fontSize ?? 24;
  const textWhiteSpace = isHtmlContent(el.content) ? "normal" : "pre-wrap";
  const baseStyle = {
    display: "flex" as const,
    flexDirection: "column" as const,
    justifyContent,
    minHeight: 0,
    fontSize: `${el.fontSize ?? 24}px`,
    lineHeight: 1.2,
    textAlign: (el.textAlign ?? "left") as "left" | "center" | "right",
    color: "#000000",
  };
  const editorStyle = {
    ...baseStyle,
    fontSize: `${editorFontSize}px`,
    whiteSpace: textWhiteSpace,
  };
  const contentProps = getTextContentProps(el.content);

  const handleEditBlur = (e: React.FocusEvent<HTMLDivElement>): void => {
    const raw = e.currentTarget.innerHTML ?? "";
    onUpdateContent(el.id, sanitizeHtml(raw));
    const next = e.relatedTarget as Node | null;
    if (next == null || !toolbarContainerRef?.current?.contains(next))
      onFinishEdit();
  };

  const content = (
    <span key={isEditing ? "edit" : "display"} style={{ display: "contents" }}>
      {isEditing ? canMeasureFill && fillEnabled ? (
        <div ref={fillEditContainerRef} style={SIZED_WRAPPER_STYLE}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `scale(${editorScale})`,
              transformOrigin: "0 0",
            }}
          >
            <div
              ref={(r) => {
                editingRefSetter(r);
                setTextDivRef(el.id, r);
                fillEditEditorRef.current = r;
              }}
              className="whiteboard-text-display"
              contentEditable
              suppressContentEditableWarning={true}
              style={{
                ...editorStyle,
                padding: 2,
                width: "max-content",
                maxWidth: "none",
              }}
              onBlur={handleEditBlur}
              onKeyDown={(e) => onEditKeyDown(e, el.id)}
              aria-label="Edit text"
            />
          </div>
        </div>
      ) : (
        <div
          ref={(r) => {
            editingRefSetter(r);
            setTextDivRef(el.id, r);
          }}
          className="whiteboard-text-display"
          contentEditable
          suppressContentEditableWarning={true}
          style={{ ...editorStyle, padding: 2 }}
          onBlur={handleEditBlur}
          onKeyDown={(e) => onEditKeyDown(e, el.id)}
          aria-label="Edit text"
        />
      ) : canMeasureFill && fillEnabled ? (
        <>
          {/* Measure div is portaled to body so it never appears inside the text box. */}
          {needMeasure &&
            measureContainerReady &&
            measurePortalContainerRef.current != null &&
            createPortal(
              <div
                ref={fillMeasureRef}
                className="whiteboard-text-display whiteboard-text-display--fit"
                style={{
                  ...baseStyle,
                  fontSize: `${FILL_REFERENCE_FONT_SIZE}px`,
                  width: "max-content",
                  maxWidth: "none",
                  whiteSpace: textWhiteSpace,
                }}
                {...contentProps}
              />,
              measurePortalContainerRef.current
            )}
          <div
            ref={(r) => {
              setTextDivRef(el.id, r);
              fillContainerRef.current = r;
            }}
            className="whiteboard-text-display whiteboard-text-display--sized"
            style={SIZED_WRAPPER_STYLE}
          >
            {fillScale != null ? (
              <div
                className="whiteboard-text-display whiteboard-text-display--fit"
                style={{
                  ...baseStyle,
                  fontSize: `${FILL_REFERENCE_FONT_SIZE}px`,
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "max-content",
                  maxWidth: "none",
                  whiteSpace: textWhiteSpace,
                  transform: `scale(${fillScale * fillFormatScale}) translateY(${FILL_VERTICAL_NUDGE_PX}px)`,
                  transformOrigin: "0 0",
                }}
                {...contentProps}
              />
            ) : (
              <div
                className="whiteboard-text-display whiteboard-text-display--fit"
                style={{
                  ...baseStyle,
                  whiteSpace: textWhiteSpace,
                  overflowWrap: "break-word",
                  overflow: "hidden",
                  width: "100%",
                  height: "100%",
                }}
                {...contentProps}
              />
            )}
          </div>
        </>
      ) : hasExplicitSize ? (
        <div
          ref={(r) => setTextDivRef(el.id, r)}
          className="whiteboard-text-display whiteboard-text-display--sized"
          style={SIZED_WRAPPER_STYLE}
        >
          <div
            className="whiteboard-text-display whiteboard-text-display--fit"
            style={{
              ...baseStyle,
              position: "absolute",
              left: 0,
              top: 0,
              whiteSpace: textWhiteSpace,
              overflowWrap: "break-word",
              overflow: "hidden",
              width: "100%",
              height: "100%",
            }}
            {...contentProps}
          />
        </div>
      ) : (
        <div
          ref={(r) => setTextDivRef(el.id, r)}
          className="whiteboard-text-display whiteboard-text-display--fit"
          style={{
            ...baseStyle,
            width: "max-content",
            maxWidth: "100%",
            whiteSpace: textWhiteSpace,
          }}
          {...contentProps}
        />
      )}
    </span>
  );

  const wrappedContent = needsWorkaround ? (
    <div
      ref={safariWrapperRef}
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      {content}
    </div>
  ) : (
    content
  );

  return (
    <foreignObject
      ref={foRef}
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
              onDoubleClick(el.id);
            }
      }
    >
      {wrappedContent}
    </foreignObject>
  );
}

export const WhiteboardTextElement = memo(WhiteboardTextElementInner);
