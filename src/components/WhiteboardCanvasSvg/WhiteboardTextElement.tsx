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
import { safeSvgNumber } from "@/lib/safeSvgNumber";
import { isHtmlContent, sanitizeHtml } from "@/lib/sanitizeHtml";
import type { TextElement } from "@/types/whiteboard";
import { verticalAlignToJustifyContent } from "./verticalAlign";

const MIN_FOREIGN_OBJECT_SIZE = 1;
const FILL_REFERENCE_FONT_SIZE = 24;
const MAX_FILL_EFFECTIVE_FONT_SIZE = 5000;
const FILL_VERTICAL_NUDGE_PX = 0.25;

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

/** Plain text for scale stability; only reset naturalSize when this or fontSize changes, not on format (b/i/u/color). */
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
  /** When true, skip onFillFittedSize to avoid lag during resize (resize handler is source of truth). */
  isResizing?: boolean;
  /** Pan/zoom for viewBox-space positioning (text layer outside transformed group). */
  viewBoxTransform: { panX: number; panY: number; zoom: number };
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
  isResizing = false,
  viewBoxTransform: { panX: vbxPanX, panY: vbxPanY, zoom: vbxZoom },
}: WhiteboardTextElementProps): JSX.Element {
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

  /* Integer dimensions reduce subpixel layout and jank on Safari/iOS. Use everywhere (foreignObject and fill scale) for consistency. */
  const foWidthRounded = Math.round(foWidth);
  const foHeightRounded = Math.round(foHeight);

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

  const needMeasureDiv =
    hasExplicitSize && fillEnabled && !isEditing;

  useLayoutEffect(() => {
    if (!hasExplicitSize || !fillEnabled || isEditing) {
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
  }, [hasExplicitSize, fillEnabled, isEditing]);

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
      !hasExplicitSize ||
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
  }, [hasExplicitSize, fillEnabled, isEditing]);

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
    if (!isEditing || !fillEnabled || !hasExplicitSize) {
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
  }, [isEditing, fillEnabled, hasExplicitSize]);

  /* In fill mode with explicit size, use rounded dimensions so fill scale matches the foreignObject size. */
  const boxH =
    hasExplicitSize && fillEnabled
      ? foHeightRounded
      : (containerSize?.height ?? foHeightRounded);
  const hasValidNaturalSize =
    naturalSize != null &&
    naturalSize.width > 0 &&
    naturalSize.height > 0;
  const fillScaleCap = MAX_FILL_EFFECTIVE_FONT_SIZE / FILL_REFERENCE_FONT_SIZE;
  /* Height-based scale. Use (naturalHeight + nudge) as divisor so when we report fittedH = (h+nudge)*fillScale
     and the parent sets el.height to that, boxH = (h+nudge)*fillScale and fillScale = boxH/(h+nudge) stays stable (no feedback loop). */
  const fillDenom = naturalSize != null ? naturalSize.height + FILL_VERTICAL_NUDGE_PX : 0;
  const fillScale =
    fillEnabled &&
    hasExplicitSize &&
    hasValidNaturalSize &&
    boxH > 0 &&
    fillDenom > 0
      ? Math.min(boxH / fillDenom, fillScaleCap)
      : null;

  useLayoutEffect(() => {
    if (
      !hasExplicitSize ||
      !fillEnabled ||
      isEditing ||
      isResizing ||
      fillMeasureRef.current == null
    ) {
      if (!hasExplicitSize || !fillEnabled || isEditing) {
        setNaturalSize(null);
      }
      return;
    }
    const div = fillMeasureRef.current;
    const w = div.scrollWidth;
    const h = div.scrollHeight;
    if (w > 0 && h > 0) {
      if (naturalSize === null) {
        setNaturalSize({ width: w, height: h });
      } else if (onFillFittedSize != null && fillScale != null) {
        const fittedW = w * fillScale;
        /* Include scaled vertical nudge in height so container doesn't clip (display uses paddingTop: nudge * fillScale). */
        const fittedH =
          h * fillScale + FILL_VERTICAL_NUDGE_PX * fillScale;
        if (fittedW > 0 && fittedH > 0) {
          onFillFittedSize(el.id, fittedW, fittedH);
        }
      }
    } else if (naturalSize === null) {
      setNaturalSize(null);
    }
  }, [
    hasExplicitSize,
    fillEnabled,
    isEditing,
    isResizing,
    measureContainerReady,
    el.content,
    el.id,
    el.fontSize,
    foWidth,
    foHeight,
    naturalSize,
    fillScale,
    onFillFittedSize,
  ]);

  useLayoutEffect(() => {
    if (fillScale != null && onEffectiveFontSize != null) {
      const effective = FILL_REFERENCE_FONT_SIZE * fillScale;
      onEffectiveFontSize(el.id, effective);
    }
  }, [el.id, fillScale, onEffectiveFontSize]);

  useLayoutEffect(() => {
    if (
      fillEnabled &&
      hasExplicitSize &&
      hasValidNaturalSize &&
      onTextAspectRatio != null
    ) {
      onTextAspectRatio(el.id, naturalSize.width / naturalSize.height);
    }
  }, [
    el.id,
    fillEnabled,
    hasExplicitSize,
    hasValidNaturalSize,
    naturalSize,
    onTextAspectRatio,
  ]);

  useLayoutEffect(() => {
    if (
      fillEnabled &&
      hasExplicitSize &&
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
    hasExplicitSize,
    hasValidNaturalSize,
    naturalSize,
    fillScaleCap,
    onMaxFillBoxSize,
  ]);

  const justifyContent = verticalAlignToJustifyContent(el.textVerticalAlign);
  const editorFontSize =
    fillEnabled &&
    hasExplicitSize &&
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

  /* Rounded world position/size; viewBox position/size for foreignObject (pan/zoom applied). */
  const foX = Math.round(el.x);
  const foY = Math.round(el.y);
  const foViewX = vbxPanX + vbxZoom * foX;
  const foViewY = vbxPanY + vbxZoom * foY;
  const foViewW = vbxZoom * foWidthRounded;
  const foViewH = vbxZoom * foHeightRounded;

  const foreignObjectContent = (
    <>
      {isEditing ? hasExplicitSize && fillEnabled ? (
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
      ) : hasExplicitSize && fillEnabled ? (
        <>
          {/* Measure div is portaled to body so it never appears inside the text box. */}
          {needMeasureDiv &&
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
                  fontSize: `${FILL_REFERENCE_FONT_SIZE * fillScale}px`,
                  lineHeight: 1.2,
                  position: "absolute",
                  left: 0,
                  top: 0,
                  /* Scale nudge with fill so alignment matches previous transform: translateY(0.25px) in scaled space. */
                  paddingTop: FILL_VERTICAL_NUDGE_PX * fillScale,
                  width: "max-content",
                  maxWidth: "none",
                  whiteSpace: textWhiteSpace,
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
    </>
  );

  return (
    <foreignObject
      x={safeSvgNumber(foViewX, 0)}
      y={safeSvgNumber(foViewY, 0)}
      width={safeSvgNumber(foViewW, MIN_FOREIGN_OBJECT_SIZE)}
      height={safeSvgNumber(foViewH, MIN_FOREIGN_OBJECT_SIZE)}
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
      <div
        style={{
          width: foWidthRounded,
          height: foHeightRounded,
          transform: `scale(${vbxZoom})`,
          transformOrigin: "0 0",
        }}
      >
        {foreignObjectContent}
      </div>
    </foreignObject>
  );
}

export const WhiteboardTextElement = memo(WhiteboardTextElementInner);
