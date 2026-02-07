import type { RefObject } from "react";
import { memo } from "react";
import {
  type ElementBounds,
  DEFAULT_UNMEASURED_TEXT_HEIGHT,
  DEFAULT_UNMEASURED_TEXT_WIDTH,
  TEXT_EDIT_HEIGHT,
  TEXT_EDIT_WIDTH,
} from "@/utils/elementBounds";
import { safeSvgNumber } from "@/utils/safeSvgNumber";
import { isHtmlContent, sanitizeHtml } from "@/utils/sanitizeHtml";
import type { TextElement } from "@/types/whiteboard";
import { verticalAlignToJustifyContent } from "./verticalAlign";

const MIN_FOREIGN_OBJECT_SIZE = 1;

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
}: WhiteboardTextElementProps): JSX.Element {
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
        : DEFAULT_UNMEASURED_TEXT_WIDTH;
  const foHeight = hasExplicitSize
    ? Math.max(MIN_FOREIGN_OBJECT_SIZE, el.height!)
    : measured !== undefined
      ? Math.max(measured.height, MIN_FOREIGN_OBJECT_SIZE)
      : isEditing
        ? TEXT_EDIT_HEIGHT
        : DEFAULT_UNMEASURED_TEXT_HEIGHT;

  const justifyContent = verticalAlignToJustifyContent(el.textVerticalAlign);
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

  return (
    <foreignObject
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
      {isEditing ? (
        <div
          ref={(r) => {
            editingRefSetter(r);
            setTextDivRef(el.id, r);
          }}
          className="whiteboard-text-display"
          contentEditable
          suppressContentEditableWarning={true}
          style={{
            ...baseStyle,
            padding: 2,
          }}
          onBlur={(e) => {
            const raw = e.currentTarget.innerHTML ?? "";
            const content = sanitizeHtml(raw);
            onUpdateContent(el.id, content);
            const next = e.relatedTarget as Node | null;
            if (
              next == null ||
              toolbarContainerRef?.current == null ||
              !toolbarContainerRef.current.contains(next)
            ) {
              onFinishEdit();
            }
          }}
          onKeyDown={(e) => onEditKeyDown(e, el.id)}
          aria-label="Edit text"
        />
      ) : hasExplicitSize ? (
        <div
          ref={(r) => setTextDivRef(el.id, r)}
          className="whiteboard-text-display whiteboard-text-display--sized"
          style={{
            ...baseStyle,
            whiteSpace: isHtmlContent(el.content) ? "normal" : "pre-wrap",
            wordBreak: "break-word",
            overflow: "hidden",
            width: "100%",
            height: "100%",
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
            ...baseStyle,
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
}

export const WhiteboardTextElement = memo(WhiteboardTextElementInner);
