import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { WhiteboardTextElement } from "./WhiteboardTextElement";
import type { TextElement } from "@/types/whiteboard";

const textEl: TextElement = {
  id: "t1",
  kind: "text",
  x: 10,
  y: 20,
  content: "Hello",
  fontSize: 16,
};

const measuredBounds: Record<string, { x: number; y: number; width: number; height: number }> = {
  t1: { x: 10, y: 20, width: 50, height: 18 },
};

function renderInSvg(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<svg>{ui}</svg>);
}

describe("WhiteboardTextElement", () => {
  it("renders foreignObject with display div and plain text", () => {
    const { container } = renderInSvg(
      <WhiteboardTextElement
        element={textEl}
        isEditing={false}
        measuredBounds={measuredBounds}
        onDoubleClick={vi.fn()}
        setTextDivRef={vi.fn()}
        onUpdateContent={vi.fn()}
        onFinishEdit={vi.fn()}
        onEditKeyDown={vi.fn()}
        editingRefSetter={vi.fn()}
      />
    );
    const fo = container.querySelector("foreignObject.whiteboard-text-edit");
    expect(fo).toBeInTheDocument();
    const div = fo!.querySelector(".whiteboard-text-display");
    expect(div).toBeInTheDocument();
    expect(div).toHaveTextContent("Hello");
  });

  it("calls onDoubleClick when double-clicked and not editing", () => {
    const onDoubleClick = vi.fn();
    const { container } = renderInSvg(
      <WhiteboardTextElement
        element={textEl}
        isEditing={false}
        measuredBounds={measuredBounds}
        onDoubleClick={onDoubleClick}
        setTextDivRef={vi.fn()}
        onUpdateContent={vi.fn()}
        onFinishEdit={vi.fn()}
        onEditKeyDown={vi.fn()}
        editingRefSetter={vi.fn()}
      />
    );
    const fo = container.querySelector("foreignObject.whiteboard-text-edit");
    expect(fo).toBeInTheDocument();
    fireEvent.doubleClick(fo!);
    expect(onDoubleClick).toHaveBeenCalledWith("t1");
  });

  it("does not call onDoubleClick when editing", () => {
    const onDoubleClick = vi.fn();
    const { container } = renderInSvg(
      <WhiteboardTextElement
        element={textEl}
        isEditing={true}
        measuredBounds={measuredBounds}
        onDoubleClick={onDoubleClick}
        setTextDivRef={vi.fn()}
        onUpdateContent={vi.fn()}
        onFinishEdit={vi.fn()}
        onEditKeyDown={vi.fn()}
        editingRefSetter={vi.fn()}
      />
    );
    const fo = container.querySelector("foreignObject.whiteboard-text-edit");
    expect(fo).toBeInTheDocument();
    fireEvent.doubleClick(fo!);
    expect(onDoubleClick).not.toHaveBeenCalled();
  });

  it("when editing, calls onUpdateContent and onFinishEdit on blur", () => {
    const onUpdateContent = vi.fn();
    const onFinishEdit = vi.fn();
    const { container } = renderInSvg(
      <WhiteboardTextElement
        element={textEl}
        isEditing={true}
        measuredBounds={measuredBounds}
        onDoubleClick={vi.fn()}
        setTextDivRef={vi.fn()}
        onUpdateContent={onUpdateContent}
        onFinishEdit={onFinishEdit}
        onEditKeyDown={vi.fn()}
        editingRefSetter={vi.fn()}
      />
    );
    const div = container.querySelector<HTMLDivElement>(
      ".whiteboard-text-display"
    );
    expect(div).toBeInTheDocument();
    if (!div) return;
    div.textContent = "Updated";
    fireEvent.blur(div);
    expect(onUpdateContent).toHaveBeenCalledWith("t1", expect.any(String));
    expect(onFinishEdit).toHaveBeenCalled();
  });

  it("when editing, onEditKeyDown is called on key down", () => {
    const onEditKeyDown = vi.fn();
    const { container } = renderInSvg(
      <WhiteboardTextElement
        element={textEl}
        isEditing={true}
        measuredBounds={measuredBounds}
        onDoubleClick={vi.fn()}
        setTextDivRef={vi.fn()}
        onUpdateContent={vi.fn()}
        onFinishEdit={vi.fn()}
        onEditKeyDown={onEditKeyDown}
        editingRefSetter={vi.fn()}
      />
    );
    const div = container.querySelector<HTMLDivElement>(
      ".whiteboard-text-display"
    );
    expect(div).toBeInTheDocument();
    if (!div) return;
    fireEvent.keyDown(div, { key: "Escape" });
    expect(onEditKeyDown).toHaveBeenCalled();
  });

  it("uses vertical alignment for layout", () => {
    const elMiddle: TextElement = {
      ...textEl,
      id: "t2",
      textVerticalAlign: "middle",
    };
    const boundsWithT2: Record<string, { x: number; y: number; width: number; height: number }> = {
      ...measuredBounds,
      t2: { x: 10, y: 20, width: 50, height: 18 },
    };
    const { container } = renderInSvg(
      <WhiteboardTextElement
        element={elMiddle}
        isEditing={false}
        measuredBounds={boundsWithT2}
        onDoubleClick={vi.fn()}
        setTextDivRef={vi.fn()}
        onUpdateContent={vi.fn()}
        onFinishEdit={vi.fn()}
        onEditKeyDown={vi.fn()}
        editingRefSetter={vi.fn()}
      />
    );
    const div = container.querySelector(".whiteboard-text-display");
    expect(div).toBeInTheDocument();
    expect(div).toHaveStyle({ justifyContent: "center" });
  });
});
