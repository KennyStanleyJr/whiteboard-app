import { useCallback, useState } from "react";
import {
  useCanvasEventListeners,
  useCanvasSize,
  usePanZoom,
  useSelectionBox,
} from "../hooks";
import type { WhiteboardElement } from "../types/whiteboard";
import { WhiteboardCanvasSvg } from "./WhiteboardCanvasSvg";

function generateElementId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function WhiteboardCanvas(): JSX.Element {
  const panZoom = usePanZoom();
  const size = useCanvasSize(panZoom.containerRef);
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);

  const selection = useSelectionBox(
    panZoom.containerRef,
    size.width,
    size.height,
    panZoom.onPointerDown,
    panZoom.onPointerMove,
    panZoom.onPointerUp,
    panZoom.onPointerLeave
  );

  const addTextAt = useCallback((x: number, y: number) => {
    const id = generateElementId();
    const textElement: WhiteboardElement = {
      id,
      x,
      y,
      kind: "text",
      content: "",
    };
    setElements((prev) => [...prev, textElement]);
    setEditingElementId(id);
  }, []);

  const handleAddTextCenter = useCallback(() => {
    const centerViewportX = size.width / 2;
    const centerViewportY = size.height / 2;
    const x = (centerViewportX - panZoom.panX) / panZoom.zoom;
    const y = (centerViewportY - panZoom.panY) / panZoom.zoom;
    addTextAt(x, y);
  }, [addTextAt, panZoom.panX, panZoom.panY, panZoom.zoom, size.height, size.width]);

  const handleUpdateElementContent = useCallback((id: string, content: string) => {
    setElements((prev) =>
      prev.map((el) =>
        el.id === id && el.kind === "text" ? { ...el, content } : el
      )
    );
  }, []);

  const handleFinishEditElement = useCallback(() => {
    setEditingElementId(null);
  }, []);

  useCanvasEventListeners(
    panZoom.containerRef,
    panZoom.handleWheelRaw,
    panZoom.handleTouchStart,
    panZoom.handleTouchMove,
    panZoom.handleTouchEnd
  );

  return (
    <div
      ref={panZoom.containerRef as React.RefObject<HTMLDivElement>}
      className="whiteboard-canvas-wrap"
    >
      <div className="whiteboard-toolbar">
        <button
          type="button"
          className="whiteboard-toolbar-btn"
          onClick={handleAddTextCenter}
          aria-label="Add text"
        >
          <span className="whiteboard-toolbar-btn-icon" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M4 7V4h16v3" />
              <path d="M9 20h6" />
              <path d="M12 4v16" />
            </svg>
          </span>
        </button>
      </div>
      <WhiteboardCanvasSvg
        panX={panZoom.panX}
        panY={panZoom.panY}
        zoom={panZoom.zoom}
        width={size.width}
        height={size.height}
        selectionRect={selection.selectionRect}
        onPointerDown={selection.handlePointerDown}
        onPointerMove={selection.handlePointerMove}
        onPointerUp={selection.handlePointerUp}
        onPointerLeave={selection.handlePointerLeave}
        onContextMenu={panZoom.onContextMenu}
        isPanning={panZoom.isPanning}
        elements={elements}
        editingElementId={editingElementId}
        onElementDoubleClick={setEditingElementId}
        onUpdateElementContent={handleUpdateElementContent}
        onFinishEditElement={handleFinishEditElement}
      />
    </div>
  );
}
