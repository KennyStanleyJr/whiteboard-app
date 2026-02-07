import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { SelectionToolbar } from ".";
import type {
  ImageElement,
  TextElement,
  WhiteboardElement,
} from "@/types/whiteboard";

/** Run the setElements updater from the first mock call with the given prev state. */
function getNextElements(
  setElements: ReturnType<typeof vi.fn>,
  prev: WhiteboardElement[]
): WhiteboardElement[] {
  const updater = setElements.mock.calls[0]?.[0] as
    | ((p: WhiteboardElement[]) => WhiteboardElement[])
    | undefined;
  return updater ? updater(prev) : [];
}

function isTextElement(el: WhiteboardElement): el is TextElement {
  return el.kind === "text";
}

const textEl: TextElement = {
  id: "a",
  kind: "text",
  x: 0,
  y: 0,
  content: "Hi",
  fontSize: 16,
  width: 100,
  height: 22,
};

function createContainerRef(): React.RefObject<HTMLDivElement | null> {
  const div = document.createElement("div");
  div.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
  return { current: div };
}

const defaultProps = {
  containerRef: { current: null } as React.RefObject<HTMLDivElement | null>,
  selectedElementIds: [] as string[],
  elements: [] as WhiteboardElement[],
  setElements: vi.fn() as React.Dispatch<React.SetStateAction<WhiteboardElement[]>>,
  measuredBounds: {} as Record<string, { x: number; y: number; width: number; height: number }>,
  panX: 0,
  panY: 0,
  zoom: 1,
  viewWidth: 800,
  viewHeight: 600,
};

describe("SelectionToolbar", () => {
  it("returns null when no elements selected", () => {
    const { container } = render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={createContainerRef()}
        selectedElementIds={[]}
        elements={[textEl]}
        measuredBounds={{ a: { x: 0, y: 0, width: 100, height: 22 } }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when containerRef.current is null", () => {
    const { container } = render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={{ current: null }}
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={{ a: { x: 0, y: 0, width: 100, height: 22 } }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders toolbar when selection has text and position is computed", () => {
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={{ a: { x: 0, y: 0, width: 100, height: 22 } }}
      />
    );
    expect(screen.getByRole("toolbar", { name: "Element options" })).toBeInTheDocument();
    expect(screen.getByLabelText("Font size")).toBeInTheDocument();
  });

  it("calls setElements when font size is increased", () => {
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={{ a: { x: 0, y: 0, width: 100, height: 22 } }}
      />
    );
    const increaseBtn = screen.getByRole("button", { name: /increase font size/i });
    fireEvent.click(increaseBtn);
    expect(setElements).toHaveBeenCalled();
    const next = getNextElements(setElements, [textEl]);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: "a", fontSize: 17 });
  });

  it("calls setElements to remove selected elements when delete is clicked", () => {
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={{ a: { x: 0, y: 0, width: 100, height: 22 } }}
      />
    );
    // Open the element actions menu
    fireEvent.click(screen.getByRole("button", { name: /element actions/i }));
    // Click the Delete menu item
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
    expect(setElements).toHaveBeenCalled();
    const next = getNextElements(setElements, [textEl]);
    expect(next).toHaveLength(0);
  });

  it("calls onCut when cut is clicked from menu", () => {
    const onCut = vi.fn();
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={{ a: { x: 0, y: 0, width: 100, height: 22 } }}
        onCut={onCut}
      />
    );
    // Open the element actions menu
    fireEvent.click(screen.getByRole("button", { name: /element actions/i }));
    // Click the Cut menu item
    fireEvent.click(screen.getByRole("menuitem", { name: /cut/i }));
    expect(onCut).toHaveBeenCalledTimes(1);
  });

  it("calls onCopy when copy is clicked from menu", () => {
    const onCopy = vi.fn();
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={{ a: { x: 0, y: 0, width: 100, height: 22 } }}
        onCopy={onCopy}
      />
    );
    // Open the element actions menu
    fireEvent.click(screen.getByRole("button", { name: /element actions/i }));
    // Click the Copy menu item
    fireEvent.click(screen.getByRole("menuitem", { name: /copy/i }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("calls onDuplicate when duplicate is clicked from menu", () => {
    const onDuplicate = vi.fn();
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={{ a: { x: 0, y: 0, width: 100, height: 22 } }}
        onDuplicate={onDuplicate}
      />
    );
    // Open the element actions menu
    fireEvent.click(screen.getByRole("button", { name: /element actions/i }));
    // Click the Duplicate menu item
    fireEvent.click(screen.getByRole("menuitem", { name: /duplicate/i }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it("closes menu after selecting an action", () => {
    const onCut = vi.fn();
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={{ a: { x: 0, y: 0, width: 100, height: 22 } }}
        onCut={onCut}
      />
    );
    // Open the element actions menu
    const menuButton = screen.getByRole("button", { name: /element actions/i });
    fireEvent.click(menuButton);
    expect(screen.getByRole("menu", { name: /element actions/i })).toBeInTheDocument();
    
    // Click the Cut menu item
    fireEvent.click(screen.getByRole("menuitem", { name: /cut/i }));
    
    // Menu should be closed
    expect(screen.queryByRole("menu", { name: /element actions/i })).not.toBeInTheDocument();
  });

  it("calls setElements when text align is changed", () => {
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={{ a: { x: 0, y: 0, width: 100, height: 22 } }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /text alignment/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /align center/i }));
    expect(setElements).toHaveBeenCalled();
    const next = getNextElements(setElements, [textEl]);
    const firstEl = next[0]!;
    expect(isTextElement(firstEl)).toBe(true);
    if (isTextElement(firstEl)) {
      expect(firstEl.textAlign).toBe("center");
    }
  });

  it("applies bold to whole element when not editing", () => {
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={{ a: { x: 0, y: 0, width: 100, height: 22 } }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Bold$/i }));
    expect(setElements).toHaveBeenCalled();
    const next = getNextElements(setElements, [textEl]);
    expect(next).toHaveLength(1);
    const firstEl = next[0]!;
    expect(isTextElement(firstEl)).toBe(true);
    if (isTextElement(firstEl)) {
      expect(firstEl.content).toBe("<b>Hi</b>");
    }
  });

  it("toggles bold off when whole element is already wrapped in <b>", () => {
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    const boldEl: TextElement = {
      ...textEl,
      id: "b",
      content: "<b>Bold text</b>",
    };
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["b"]}
        elements={[boldEl]}
        measuredBounds={{ b: { x: 0, y: 0, width: 100, height: 22 } }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Bold$/i }));
    expect(setElements).toHaveBeenCalled();
    const next = getNextElements(setElements, [boldEl]);
    expect(next).toHaveLength(1);
    const firstEl = next[0]!;
    expect(isTextElement(firstEl)).toBe(true);
    if (isTextElement(firstEl)) {
      expect(firstEl.content).toBe("Bold text");
    }
  });

  it("renders Bold, Italic, Underline and Text color when text is selected", () => {
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={{ a: { x: 0, y: 0, width: 100, height: 22 } }}
      />
    );
    expect(screen.getByRole("button", { name: /^Bold$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Italic$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Underline$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /text color/i })).toBeInTheDocument();
  });

  it("adds format to all selected elements when not all have it (multi-select)", () => {
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    const plainEl: TextElement = { ...textEl, id: "a", content: "Hi" };
    const boldEl: TextElement = {
      ...textEl,
      id: "b",
      content: "<b>Bold</b>",
    };
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["a", "b"]}
        elements={[plainEl, boldEl]}
        measuredBounds={{
          a: { x: 0, y: 0, width: 50, height: 22 },
          b: { x: 60, y: 0, width: 50, height: 22 },
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Bold$/i }));
    expect(setElements).toHaveBeenCalled();
    const next = getNextElements(setElements, [plainEl, boldEl]);
    expect(next).toHaveLength(2);
    expect(isTextElement(next[0]!)).toBe(true);
    if (isTextElement(next[0]!)) {
      expect(next[0].content).toBe("<b>Hi</b>");
    }
    expect(isTextElement(next[1]!)).toBe(true);
    if (isTextElement(next[1]!)) {
      expect(next[1].content).toBe("<b>Bold</b>");
    }
  });

  it("removes format from all selected elements when all have it (multi-select)", () => {
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    const bold1: TextElement = { ...textEl, id: "a", content: "<b>One</b>" };
    const bold2: TextElement = { ...textEl, id: "b", content: "<b>Two</b>" };
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["a", "b"]}
        elements={[bold1, bold2]}
        measuredBounds={{
          a: { x: 0, y: 0, width: 50, height: 22 },
          b: { x: 60, y: 0, width: 50, height: 22 },
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Bold$/i }));
    expect(setElements).toHaveBeenCalled();
    const next = getNextElements(setElements, [bold1, bold2]);
    expect(next).toHaveLength(2);
    expect(isTextElement(next[0]!)).toBe(true);
    if (isTextElement(next[0]!)) {
      expect(next[0].content).toBe("One");
    }
    expect(isTextElement(next[1]!)).toBe(true);
    if (isTextElement(next[1]!)) {
      expect(next[1].content).toBe("Two");
    }
  });

  it("calls onFormatCommand when editing and does not call setElements for bold", () => {
    const onFormatCommand = vi.fn();
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["a"]}
        elements={[textEl]}
        measuredBounds={{ a: { x: 0, y: 0, width: 100, height: 22 } }}
        editingElementId="a"
        onFormatCommand={onFormatCommand}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Bold$/i }));
    expect(onFormatCommand).toHaveBeenCalledWith("bold", undefined);
    expect(setElements).not.toHaveBeenCalled();
  });

  it("adds italic to all selected when not all have it (multi-select)", () => {
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    const plainEl: TextElement = { ...textEl, id: "a", content: "A" };
    const italicEl: TextElement = { ...textEl, id: "b", content: "<i>B</i>" };
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["a", "b"]}
        elements={[plainEl, italicEl]}
        measuredBounds={{
          a: { x: 0, y: 0, width: 50, height: 22 },
          b: { x: 60, y: 0, width: 50, height: 22 },
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Italic$/i }));
    const next = getNextElements(setElements, [plainEl, italicEl]);
    expect(isTextElement(next[0]!)).toBe(true);
    if (isTextElement(next[0]!)) {
      expect(next[0].content).toBe("<i>A</i>");
    }
    expect(isTextElement(next[1]!)).toBe(true);
    if (isTextElement(next[1]!)) {
      expect(next[1].content).toBe("<i>B</i>");
    }
  });

  it("removes italic from all selected when all have it (multi-select)", () => {
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    const italic1: TextElement = { ...textEl, id: "a", content: "<i>One</i>" };
    const italic2: TextElement = { ...textEl, id: "b", content: "<i>Two</i>" };
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["a", "b"]}
        elements={[italic1, italic2]}
        measuredBounds={{
          a: { x: 0, y: 0, width: 50, height: 22 },
          b: { x: 60, y: 0, width: 50, height: 22 },
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Italic$/i }));
    const next = getNextElements(setElements, [italic1, italic2]);
    expect(isTextElement(next[0]!)).toBe(true);
    if (isTextElement(next[0]!)) {
      expect(next[0].content).toBe("One");
    }
    expect(isTextElement(next[1]!)).toBe(true);
    if (isTextElement(next[1]!)) {
      expect(next[1].content).toBe("Two");
    }
  });

  it("adds underline to all selected when not all have it (multi-select)", () => {
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    const plainEl: TextElement = { ...textEl, id: "a", content: "X" };
    const underlineEl: TextElement = {
      ...textEl,
      id: "b",
      content: "<u>Y</u>",
    };
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["a", "b"]}
        elements={[plainEl, underlineEl]}
        measuredBounds={{
          a: { x: 0, y: 0, width: 50, height: 22 },
          b: { x: 60, y: 0, width: 50, height: 22 },
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Underline$/i }));
    const next = getNextElements(setElements, [plainEl, underlineEl]);
    expect(isTextElement(next[0]!)).toBe(true);
    if (isTextElement(next[0]!)) {
      expect(next[0].content).toBe("<u>X</u>");
    }
    expect(isTextElement(next[1]!)).toBe(true);
    if (isTextElement(next[1]!)) {
      expect(next[1].content).toBe("<u>Y</u>");
    }
  });

  it("renders fill container button when image is selected", () => {
    const imageEl: ImageElement = {
      id: "img1",
      kind: "image",
      x: 0,
      y: 0,
      src: "data:image/png;base64,x",
      width: 100,
      height: 80,
    };
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        selectedElementIds={["img1"]}
        elements={[imageEl]}
        measuredBounds={{ img1: { x: 0, y: 0, width: 100, height: 80 } }}
      />
    );
    expect(
      screen.getByRole("button", {
        name: /enable fill container|disable fill container/i,
      })
    ).toBeInTheDocument();
  });

  it("renders corner radius menu when image is selected and applies selection", () => {
    const imageEl: ImageElement = {
      id: "img1",
      kind: "image",
      x: 0,
      y: 0,
      src: "data:image/png;base64,x",
      width: 100,
      height: 80,
    };
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["img1"]}
        elements={[imageEl]}
        measuredBounds={{ img1: { x: 0, y: 0, width: 100, height: 80 } }}
      />
    );
    const cornerBtn = screen.getByRole("button", { name: /corner radius/i });
    expect(cornerBtn).toBeInTheDocument();
    fireEvent.click(cornerBtn);
    const smallOption = screen.getByRole("menuitem", {
      name: /small rounded corners/i,
    });
    fireEvent.click(smallOption);
    const next = getNextElements(setElements, [imageEl]);
    expect(next[0]).toMatchObject({
      kind: "image",
      imageCornerRadius: "small",
    });
  });

  it("applies full corner radius via menu", () => {
    const imageEl: ImageElement = {
      id: "img1",
      kind: "image",
      x: 0,
      y: 0,
      src: "data:image/png;base64,x",
      width: 100,
      height: 80,
    };
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["img1"]}
        elements={[imageEl]}
        measuredBounds={{ img1: { x: 0, y: 0, width: 100, height: 80 } }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /corner radius/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /rounded full/i }));
    expect(getNextElements(setElements, [imageEl])[0]).toMatchObject({
      imageCornerRadius: "full",
    });
  });

  it("applies none corner radius via menu", () => {
    const imageEl: ImageElement = {
      id: "img1",
      kind: "image",
      x: 0,
      y: 0,
      src: "data:image/png;base64,x",
      width: 100,
      height: 80,
      imageCornerRadius: "large",
    };
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["img1"]}
        elements={[imageEl]}
        measuredBounds={{ img1: { x: 0, y: 0, width: 100, height: 80 } }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /corner radius/i }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: /no rounded corners/i })
    );
    expect(getNextElements(setElements, [imageEl])[0]).toMatchObject({
      imageCornerRadius: "none",
    });
  });

  it("toggles image imageFill when fill container button is clicked", () => {
    const imageEl: ImageElement = {
      id: "img1",
      kind: "image",
      x: 0,
      y: 0,
      src: "data:image/png;base64,x",
      width: 100,
      height: 80,
    };
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["img1"]}
        elements={[imageEl]}
        measuredBounds={{ img1: { x: 0, y: 0, width: 100, height: 80 } }}
      />
    );
    const btn = screen.getByRole("button", {
      name: /enable fill container|disable fill container/i,
    });
    fireEvent.click(btn);
    expect(setElements).toHaveBeenCalled();
    const next = getNextElements(setElements, [imageEl]);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ kind: "image", imageFill: true });
  });

  it("shows Get info in element actions and calls onGetImageInfo when single image selected", () => {
    const imageEl: ImageElement = {
      id: "img1",
      kind: "image",
      x: 0,
      y: 0,
      src: "data:image/png;base64,x",
      width: 100,
      height: 80,
    };
    const onGetImageInfo = vi.fn();
    const containerRef = createContainerRef();
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        selectedElementIds={["img1"]}
        elements={[imageEl]}
        measuredBounds={{ img1: { x: 0, y: 0, width: 100, height: 80 } }}
        onGetImageInfo={onGetImageInfo}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /element actions/i }));
    const getInfoItem = screen.getByRole("menuitem", { name: /get info/i });
    expect(getInfoItem).toBeInTheDocument();
    fireEvent.click(getInfoItem);
    expect(onGetImageInfo).toHaveBeenCalledTimes(1);
  });

  it("removes underline from all selected when all have it (multi-select)", () => {
    const setElements = vi.fn();
    const containerRef = createContainerRef();
    const u1: TextElement = { ...textEl, id: "a", content: "<u>One</u>" };
    const u2: TextElement = { ...textEl, id: "b", content: "<u>Two</u>" };
    render(
      <SelectionToolbar
        {...defaultProps}
        containerRef={containerRef}
        setElements={setElements}
        selectedElementIds={["a", "b"]}
        elements={[u1, u2]}
        measuredBounds={{
          a: { x: 0, y: 0, width: 50, height: 22 },
          b: { x: 60, y: 0, width: 50, height: 22 },
        }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Underline$/i }));
    const next = getNextElements(setElements, [u1, u2]);
    expect(isTextElement(next[0]!)).toBe(true);
    if (isTextElement(next[0]!)) {
      expect(next[0].content).toBe("One");
    }
    expect(isTextElement(next[1]!)).toBe(true);
    if (isTextElement(next[1]!)) {
      expect(next[1].content).toBe("Two");
    }
  });
});
