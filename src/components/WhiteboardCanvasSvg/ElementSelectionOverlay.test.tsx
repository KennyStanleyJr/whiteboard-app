import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { ElementSelectionOverlay } from "./ElementSelectionOverlay";
import type { TextElement } from "@/types/whiteboard";

const textEl: TextElement = {
  id: "a",
  kind: "text",
  x: 10,
  y: 20,
  content: "Hi",
  fontSize: 16,
  width: 100,
  height: 22,
};

const measuredBounds = {
  a: { x: 10, y: 20, width: 100, height: 22 },
};

function renderInSvg(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<svg>{ui}</svg>);
}

describe("ElementSelectionOverlay", () => {
  it("renders nothing when no elements selected", () => {
    const { container } = renderInSvg(
      <ElementSelectionOverlay
        selectedElementIds={[]}
        elements={[textEl]}
        measuredBounds={measuredBounds}
        zoom={1}
      />
    );
    const box = container.querySelector(".element-selection-box");
    expect(box).not.toBeInTheDocument();
  });

  it("renders selection box for selected element", () => {
    const { container } = renderInSvg(
      <ElementSelectionOverlay
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={measuredBounds}
        zoom={1}
      />
    );
    const box = container.querySelector(".element-selection-box");
    expect(box).toBeInTheDocument();
    expect(box?.getAttribute("x")).toBeDefined();
    expect(box?.getAttribute("y")).toBeDefined();
  });

  it("does not render resize handles when handlers are not provided", () => {
    const { container } = renderInSvg(
      <ElementSelectionOverlay
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={measuredBounds}
        zoom={1}
      />
    );
    const handles = container.querySelectorAll(".resize-handle");
    expect(handles).toHaveLength(0);
  });

  it("renders resize handles when single element selected and handlers provided", () => {
    const onResizeHandleDown = vi.fn();
    const onResizeHandleMove = vi.fn();
    const onResizeHandleUp = vi.fn();
    const { container } = renderInSvg(
      <ElementSelectionOverlay
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={measuredBounds}
        zoom={1}
        onResizeHandleDown={onResizeHandleDown}
        onResizeHandleMove={onResizeHandleMove}
        onResizeHandleUp={onResizeHandleUp}
      />
    );
    const handles = container.querySelectorAll(".resize-handle");
    expect(handles.length).toBeGreaterThan(0);
  });

  it("calls onResizeHandleDown when resize handle is pointer down", () => {
    const onResizeHandleDown = vi.fn();
    const { container } = renderInSvg(
      <ElementSelectionOverlay
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={measuredBounds}
        zoom={1}
        onResizeHandleDown={onResizeHandleDown}
        onResizeHandleMove={vi.fn()}
        onResizeHandleUp={vi.fn()}
      />
    );
    const handle = container.querySelector(".resize-handle");
    expect(handle).toBeInTheDocument();
    if (handle) {
      fireEvent.pointerDown(handle, { pointerId: 1, clientX: 0, clientY: 0 });
      expect(onResizeHandleDown).toHaveBeenCalled();
    }
  });
});
