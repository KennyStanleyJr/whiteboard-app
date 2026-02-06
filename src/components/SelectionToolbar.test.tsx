import { render, screen, fireEvent } from "@testing-library/react";
import { SelectionToolbar } from "./SelectionToolbar";
import type { TextElement } from "@/types/whiteboard";

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
  elements: [] as TextElement[],
  setElements: vi.fn() as React.Dispatch<React.SetStateAction<TextElement[]>>,
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
    type Updater = (prev: TextElement[]) => TextElement[];
    const next = (setElements.mock.calls[0]?.[0] as Updater)([textEl]);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: "a", fontSize: 17 });
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
    type Updater = (prev: TextElement[]) => TextElement[];
    const next = (setElements.mock.calls[0]?.[0] as Updater)([textEl]);
    expect(next[0]).toMatchObject({ id: "a", textAlign: "center" });
  });
});
