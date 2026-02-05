import { usePanZoom } from "../hooks/usePanZoom";
import { useCanvasEventListeners } from "../hooks/useCanvasEventListeners";
import { useCanvasSize } from "../hooks/useCanvasSize";
import { useSelectionBox } from "../hooks/useSelectionBox";
import { WhiteboardCanvasSvg } from "./WhiteboardCanvasSvg";

export function WhiteboardCanvas(): JSX.Element {
  const panZoom = usePanZoom();
  const size = useCanvasSize(panZoom.containerRef);
  const selection = useSelectionBox(
    panZoom.containerRef,
    size.width,
    size.height,
    panZoom.onPointerDown,
    panZoom.onPointerMove,
    panZoom.onPointerUp,
    panZoom.onPointerLeave
  );
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
      />
    </div>
  );
}
