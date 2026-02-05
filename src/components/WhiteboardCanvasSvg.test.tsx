import { render, fireEvent } from "@testing-library/react";
import { WhiteboardCanvasSvg } from "./WhiteboardCanvasSvg";

const noop = (): void => {};

const defaultProps = {
  panX: 0,
  panY: 0,
  zoom: 1,
  width: 800,
  height: 600,
  selectionRect: null,
  onPointerDown: noop,
  onPointerMove: noop,
  onPointerUp: noop,
  onPointerLeave: noop,
  onContextMenu: noop,
  isPanning: false,
  elements: [],
  editingElementId: null,
  onElementDoubleClick: noop,
  onUpdateElementContent: noop,
  onFinishEditElement: noop,
};

describe("WhiteboardCanvasSvg", () => {
  it("renders SVG with correct viewBox", () => {
    const { container } = render(
      <WhiteboardCanvasSvg {...defaultProps} width={800} height={600} />
    );
    const el = container.querySelector("svg.whiteboard-canvas");
    expect(el).toBeInTheDocument();
    expect(el?.getAttribute("viewBox")).toBe("0 0 800 600");
  });

  it("applies transform from pan and zoom", () => {
    const { container } = render(
      <WhiteboardCanvasSvg {...defaultProps} panX={100} panY={50} zoom={2} />
    );
    const g = container.querySelector("g[transform]");
    expect(g?.getAttribute("transform")).toBe("translate(100, 50) scale(2)");
  });

  it("shows grabbing cursor when panning", () => {
    const { container } = render(<WhiteboardCanvasSvg {...defaultProps} isPanning={true} />);
    const g = container.querySelector("g");
    expect(g?.style.cursor).toBe("grabbing");
  });

  it("shows default cursor when not panning", () => {
    const { container } = render(<WhiteboardCanvasSvg {...defaultProps} isPanning={false} />);
    const g = container.querySelector("g");
    expect(g?.style.cursor).toBe("default");
  });

  it("does not render selection box when selectionRect is null", () => {
    const { container } = render(<WhiteboardCanvasSvg {...defaultProps} />);
    const selectionBox = container.querySelector(".selection-box");
    expect(selectionBox).not.toBeInTheDocument();
  });

  it("renders selection box when selectionRect is provided", () => {
    const { container } = render(
      <WhiteboardCanvasSvg
        {...defaultProps}
        selectionRect={{ x: 10, y: 20, width: 50, height: 30 }}
      />
    );
    const selectionBox = container.querySelector(".selection-box");
    expect(selectionBox).toBeInTheDocument();
    expect(selectionBox?.getAttribute("x")).toBe("10");
    expect(selectionBox?.getAttribute("y")).toBe("20");
    expect(selectionBox?.getAttribute("width")).toBe("50");
    expect(selectionBox?.getAttribute("height")).toBe("30");
  });

  it("calls onPointerDown when pointer down on canvas", () => {
    const onPointerDown = vi.fn();
    const { container } = render(
      <WhiteboardCanvasSvg {...defaultProps} onPointerDown={onPointerDown} />
    );
    const g = container.querySelector("g");
    expect(g).toBeInTheDocument();
    fireEvent.pointerDown(g!, { clientX: 0, clientY: 0 });
    expect(onPointerDown).toHaveBeenCalled();
  });

  it("calls onContextMenu when context menu triggered", () => {
    const onContextMenu = vi.fn();
    const { container } = render(
      <WhiteboardCanvasSvg {...defaultProps} onContextMenu={onContextMenu} />
    );
    const g = container.querySelector("g");
    fireEvent.contextMenu(g!, { button: 2 });
    expect(onContextMenu).toHaveBeenCalled();
  });

  it("renders a text element as a foreignObject with display div", () => {
    const { container } = render(
      <WhiteboardCanvasSvg
        {...defaultProps}
        elements={[
          { id: "t1", kind: "text", x: 10, y: 20, content: "Hello" },
        ]}
      />
    );
    const fo = container.querySelector("foreignObject.whiteboard-text-edit");
    expect(fo).toBeInTheDocument();
    const div = fo!.querySelector(".whiteboard-text-display");
    expect(div).toBeInTheDocument();
    expect(div).toHaveTextContent("Hello");
  });

  it("calls onElementDoubleClick when double-clicking a non-editing text element", () => {
    const onElementDoubleClick = vi.fn();
    const { container } = render(
      <WhiteboardCanvasSvg
        {...defaultProps}
        elements={[
          { id: "t1", kind: "text", x: 10, y: 20, content: "Hello" },
        ]}
        onElementDoubleClick={onElementDoubleClick}
      />
    );
    const fo = container.querySelector("foreignObject.whiteboard-text-edit");
    expect(fo).toBeInTheDocument();
    fireEvent.doubleClick(fo!);
    expect(onElementDoubleClick).toHaveBeenCalledWith("t1");
  });

  it("updates element content and finishes editing on blur", () => {
    const onUpdateElementContent = vi.fn();
    const onFinishEditElement = vi.fn();
    const { container } = render(
      <WhiteboardCanvasSvg
        {...defaultProps}
        elements={[
          { id: "t1", kind: "text", x: 10, y: 20, content: "Initial" },
        ]}
        editingElementId="t1"
        onUpdateElementContent={onUpdateElementContent}
        onFinishEditElement={onFinishEditElement}
      />
    );
    const div = container.querySelector<HTMLDivElement>(
      ".whiteboard-text-display"
    );
    expect(div).toBeInTheDocument();
    if (!div) return;
    div.textContent = "Updated";
    fireEvent.blur(div);
    expect(onUpdateElementContent).toHaveBeenCalledWith("t1", "Updated");
    expect(onFinishEditElement).toHaveBeenCalled();
  });

  it("updates element content and finishes editing on Enter", () => {
    const onUpdateElementContent = vi.fn();
    const onFinishEditElement = vi.fn();
    const { container } = render(
      <WhiteboardCanvasSvg
        {...defaultProps}
        elements={[
          { id: "t1", kind: "text", x: 10, y: 20, content: "Initial" },
        ]}
        editingElementId="t1"
        onUpdateElementContent={onUpdateElementContent}
        onFinishEditElement={onFinishEditElement}
      />
    );
    const div = container.querySelector<HTMLDivElement>(
      ".whiteboard-text-display"
    );
    expect(div).toBeInTheDocument();
    if (!div) return;
    div.textContent = "Updated via Enter";
    fireEvent.keyDown(div, { key: "Enter" });
    expect(onUpdateElementContent).toHaveBeenCalledWith(
      "t1",
      "Updated via Enter"
    );
    expect(onFinishEditElement).toHaveBeenCalled();
  });
});
