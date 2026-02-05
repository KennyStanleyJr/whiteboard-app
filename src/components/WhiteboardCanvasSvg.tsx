import { useRef, useEffect } from "react";
import type { SelectionRect } from "../hooks";
import type { WhiteboardElement } from "../types/whiteboard";
import { DotGridPattern, PATTERN_ID } from "./DotGridPattern";

const CANVAS_EXTENT = 500000;
const TEXT_EDIT_WIDTH = 280;
// Slightly taller than font size so descenders aren't clipped while typing
const TEXT_EDIT_HEIGHT = 22;

export interface WhiteboardCanvasSvgProps {
  panX: number;
  panY: number;
  zoom: number;
  width: number;
  height: number;
  selectionRect: SelectionRect | null;
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
}

export function WhiteboardCanvasSvg(props: WhiteboardCanvasSvgProps): JSX.Element {
  const {
    panX,
    panY,
    zoom,
    width,
    height,
    selectionRect,
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
  } = props;

  const transform = `translate(${panX}, ${panY}) scale(${zoom})`;
  const viewBox = `0 0 ${width} ${height}`;
  const editingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (editingElementId == null || !editingRef.current) return;
    const el = elements.find(
      (e) => e.id === editingElementId && e.kind === "text"
    );
    if (!el) return;
    // Initialize editable content from the latest state, then let the DOM own it.
    editingRef.current.textContent = el.content;
    editingRef.current.focus();
  }, [editingElementId, elements]);

  const handleEditKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    id: string
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const content = e.currentTarget.textContent ?? "";
      onUpdateElementContent(id, content);
      onFinishEditElement();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onFinishEditElement();
    }
  };

  return (
    <svg
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
          return (
            <foreignObject
              key={el.id}
              x={el.x}
              y={el.y}
              width={TEXT_EDIT_WIDTH}
              height={TEXT_EDIT_HEIGHT}
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
                  ref={editingRef}
                  className="whiteboard-text-display"
                  contentEditable
                  suppressContentEditableWarning={true}
                  onBlur={(e) => {
                    const content = e.currentTarget.textContent ?? "";
                    onUpdateElementContent(el.id, content);
                    onFinishEditElement();
                  }}
                  onKeyDown={(e) => handleEditKeyDown(e, el.id)}
                  aria-label="Edit text"
                />
              ) : (
                <div className="whiteboard-text-display">{el.content}</div>
              )}
            </foreignObject>
          );
        })}
      </g>
      {selectionRect !== null && (
        <rect
          className="selection-box"
          x={selectionRect.x}
          y={selectionRect.y}
          width={selectionRect.width}
          height={selectionRect.height}
          fill="rgba(0, 120, 215, 0.1)"
          stroke="rgba(0, 120, 215, 0.8)"
          strokeWidth={1.5}
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
