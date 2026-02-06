import { renderHook, act } from "@testing-library/react";
import type { SetStateAction } from "react";
import { useElementSelection } from "./useElementSelection";
import type { SelectionRect } from "./useSelectionBox";
import type { TextElement, WhiteboardElement } from "../../types/whiteboard";
import type { SetElementsOptions } from "../useUndoRedo";

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

/** Stable reference so useEffect in useElementSelection doesn't re-run on every render. */
const elements = [textEl];
const measuredBounds = { t1: { x: 100, y: 50, width: 100, height: 22 } };

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
        elements,
        setElements,
        null,
        measuredBounds,
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
        elements,
        setElements,
        null,
        measuredBounds,
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
        elements,
        setElements,
        null,
        measuredBounds,
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
          elements,
          setElements,
          selectionRect,
          measuredBounds,
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
        elements,
        setElements,
        null,
        measuredBounds,
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

  it("uses pushToPast on first drag move and skipHistory for subsequent moves", () => {
    const containerRef = createContainer();
    const setElements = vi.fn<
      (
        action: SetStateAction<WhiteboardElement[]>,
        options?: SetElementsOptions
      ) => void
    >();

    const { result } = renderHook(() =>
      useElementSelection(
        containerRef,
        800,
        600,
        0,
        0,
        1,
        elements,
        setElements,
        null,
        measuredBounds,
        defaultSelectionHandlers,
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
    expect(setElements).not.toHaveBeenCalled();

    act(() => {
      result.current.handlers.handlePointerMove({
        clientX: 160,
        clientY: 71,
        pointerId: 1,
        buttons: 1,
      } as unknown as React.PointerEvent);
    });

    expect(setElements).toHaveBeenCalledTimes(2);
    const firstCall = setElements.mock.calls[0];
    const secondCall = setElements.mock.calls[1];

    expect(firstCall?.[1]).toEqual({ pushToPast: true });
    expect(secondCall?.[1]).toEqual({ skipHistory: true });

    act(() => {
      result.current.handlers.handlePointerMove({
        clientX: 170,
        clientY: 81,
        pointerId: 1,
        buttons: 1,
      } as unknown as React.PointerEvent);
    });

    expect(setElements).toHaveBeenCalledTimes(3);
    const thirdCall = setElements.mock.calls[2];
    expect(thirdCall?.[1]).toEqual({ skipHistory: true });
  });
});
