import { renderHook, act } from "@testing-library/react";
import { useElementSelection } from "./useElementSelection";
import type { SelectionRect } from "./useSelectionBox";
import type { TextElement } from "../../types/whiteboard";

const textEl: TextElement = {
  id: "t1",
  kind: "text",
  x: 100,
  y: 50,
  content: "Hi",
  width: 100,
  height: 22,
  fontSize: 16,
};

const noop = (): void => {};

const defaultSelectionHandlers = {
  handlePointerDown: noop,
  handlePointerMove: noop,
  handlePointerUp: noop,
  handlePointerLeave: noop,
};

const defaultPanZoomHandlers = {
  onPointerDown: noop,
  onPointerMove: noop,
  onPointerUp: noop,
  onPointerLeave: noop,
};

function createContainer(): { current: HTMLDivElement } {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
  return { current: el };
}

describe("useElementSelection", () => {
  it("returns initial selectedElementIds empty and isDragging false", () => {
    const containerRef = createContainer();
    const setElements = vi.fn();

    const { result } = renderHook(() =>
      useElementSelection(
        containerRef,
        800,
        600,
        0,
        0,
        1,
        [textEl],
        setElements,
        null,
        { t1: { x: 100, y: 50, width: 100, height: 22 } },
        defaultSelectionHandlers,
        defaultPanZoomHandlers,
        null
      )
    );

    expect(result.current.selectedElementIds).toEqual([]);
    expect(result.current.isDragging).toBe(false);
    expect(typeof result.current.handlers.handlePointerDown).toBe("function");
    expect(typeof result.current.handlers.handlePointerUp).toBe("function");
  });

  it("selects element on pointer down when hit", () => {
    const containerRef = createContainer();
    const setElements = vi.fn();
    const selectionHandlers = {
      ...defaultSelectionHandlers,
      handlePointerDown: vi.fn(),
    };

    const { result } = renderHook(() =>
      useElementSelection(
        containerRef,
        800,
        600,
        0,
        0,
        1,
        [textEl],
        setElements,
        null,
        { t1: { x: 100, y: 50, width: 100, height: 22 } },
        selectionHandlers,
        defaultPanZoomHandlers,
        null
      )
    );

    act(() => {
      result.current.handlers.handlePointerDown({
        button: 0,
        clientX: 150,
        clientY: 61,
        pointerId: 1,
        target: containerRef.current,
        buttons: 1,
      } as unknown as React.PointerEvent);
    });

    expect(result.current.selectedElementIds).toContain("t1");
  });

  it("clears selection on pointer down when no hit", () => {
    const containerRef = createContainer();
    const setElements = vi.fn();
    const selectionHandlers = {
      ...defaultSelectionHandlers,
      handlePointerDown: vi.fn(),
    };

    const { result } = renderHook(() =>
      useElementSelection(
        containerRef,
        800,
        600,
        0,
        0,
        1,
        [textEl],
        setElements,
        null,
        { t1: { x: 100, y: 50, width: 100, height: 22 } },
        selectionHandlers,
        defaultPanZoomHandlers,
        null
      )
    );

    act(() => {
      result.current.handlers.handlePointerDown({
        button: 0,
        clientX: 150,
        clientY: 61,
        pointerId: 1,
        target: containerRef.current,
        buttons: 1,
      } as unknown as React.PointerEvent);
    });
    expect(result.current.selectedElementIds).toContain("t1");

    act(() => {
      result.current.handlers.handlePointerDown({
        button: 0,
        clientX: 500,
        clientY: 500,
        pointerId: 1,
        target: containerRef.current,
        buttons: 1,
      } as unknown as React.PointerEvent);
    });

    expect(result.current.selectedElementIds).toEqual([]);
  });

  it("sets selection from marquee on pointer up when selectionRect provided", () => {
    const containerRef = createContainer();
    const setElements = vi.fn();
    const selectionHandlers = {
      ...defaultSelectionHandlers,
      handlePointerDown: vi.fn(),
      handlePointerUp: vi.fn(),
    };

    type Props = { selectionRect: SelectionRect | null };
    const initialProps: Props = { selectionRect: null };
    const { result, rerender } = renderHook(
      ({ selectionRect }: Props) =>
        useElementSelection(
          containerRef,
          800,
          600,
          0,
          0,
          1,
          [textEl],
          setElements,
          selectionRect,
          { t1: { x: 100, y: 50, width: 100, height: 22 } },
          selectionHandlers,
          defaultPanZoomHandlers,
          null
        ),
      { initialProps }
    );

    const rectProps: Props = {
      selectionRect: { x: 100, y: 50, width: 100, height: 22 },
    };
    rerender(rectProps);

    act(() => {
      result.current.handlers.handlePointerUp({
        button: 0,
        buttons: 0,
        pointerId: 1,
        target: containerRef.current,
      } as unknown as React.PointerEvent);
    });

    expect(result.current.selectedElementIds).toContain("t1");
  });

  it("calls through to selection and panZoom handlers", () => {
    const containerRef = createContainer();
    const setElements = vi.fn();
    const onPointerDown = vi.fn();
    const onPointerUp = vi.fn();

    const { result } = renderHook(() =>
      useElementSelection(
        containerRef,
        800,
        600,
        0,
        0,
        1,
        [textEl],
        setElements,
        null,
        { t1: { x: 100, y: 50, width: 100, height: 22 } },
        { ...defaultSelectionHandlers, handlePointerDown: vi.fn() },
        { ...defaultPanZoomHandlers, onPointerDown, onPointerUp },
        null
      )
    );

    act(() => {
      result.current.handlers.handlePointerDown({
        button: 0,
        clientX: 150,
        clientY: 61,
        pointerId: 1,
        target: containerRef.current,
        buttons: 1,
      } as unknown as React.PointerEvent);
    });
    expect(onPointerDown).toHaveBeenCalled();

    act(() => {
      result.current.handlers.handlePointerUp({
        button: 0,
        buttons: 0,
        pointerId: 1,
        target: containerRef.current,
      } as unknown as React.PointerEvent);
    });
    expect(onPointerUp).toHaveBeenCalled();
  });
});
