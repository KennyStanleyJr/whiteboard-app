import { renderHook, act } from "@testing-library/react";
import { useSelectionBox } from "./useSelectionBox";

describe("useSelectionBox", () => {
  it("returns selectionRect null initially", () => {
    const containerRef = { current: document.createElement("div") };
    containerRef.current.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);

    const noop = (): void => {};
    const { result } = renderHook(() =>
      useSelectionBox(
        containerRef,
        800,
        600,
        noop,
        noop,
        noop,
        noop
      )
    );

    expect(result.current.selectionRect).toBeNull();
  });

  it("returns handlers", () => {
    const containerRef = { current: document.createElement("div") };
    containerRef.current.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);

    const noop = (): void => {};
    const { result } = renderHook(() =>
      useSelectionBox(
        containerRef,
        800,
        600,
        noop,
        noop,
        noop,
        noop
      )
    );

    expect(typeof result.current.handlePointerDown).toBe("function");
    expect(typeof result.current.handlePointerMove).toBe("function");
    expect(typeof result.current.handlePointerUp).toBe("function");
    expect(typeof result.current.handlePointerLeave).toBe("function");
  });

  it("produces selection rect on left-button drag", () => {
    const container = document.createElement("div");
    container.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
    (container as HTMLElement & { setPointerCapture?: (id: number) => void; releasePointerCapture?: (id: number) => void }).setPointerCapture = vi.fn();
    (container as HTMLElement & { releasePointerCapture?: (id: number) => void }).releasePointerCapture = vi.fn();
    const containerRef = { current: container };

    const onPointerDown = vi.fn();
    const onPointerMove = vi.fn();
    const onPointerUp = vi.fn();
    const onPointerLeave = vi.fn();

    const { result, rerender } = renderHook(() =>
      useSelectionBox(
        containerRef,
        800,
        600,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerLeave
      )
    );

    act(() => {
      result.current.handlePointerDown({
        button: 0,
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        target: container,
        buttons: 1,
      } as unknown as React.PointerEvent);
    });
    rerender();

    act(() => {
      result.current.handlePointerMove({
        button: 0,
        buttons: 1,
        clientX: 200,
        clientY: 150,
        pointerId: 1,
        target: container,
      } as unknown as React.PointerEvent);
    });
    rerender();

    expect(result.current.selectionRect).not.toBeNull();
    expect(result.current.selectionRect?.width).toBeGreaterThan(0);
    expect(result.current.selectionRect?.height).toBeGreaterThan(0);

    act(() => {
      result.current.handlePointerUp({
        button: 0,
        buttons: 0,
        pointerId: 1,
        target: container,
      } as unknown as React.PointerEvent);
    });
    rerender();

    expect(result.current.selectionRect).toBeNull();
  });

  it("ignores pointer down with non-left button", () => {
    const container = document.createElement("div");
    container.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
    const containerRef = { current: container };

    const noop = vi.fn();
    const { result } = renderHook(() =>
      useSelectionBox(containerRef, 800, 600, noop, noop, noop, noop)
    );

    result.current.handlePointerDown({
      button: 2,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      target: container,
    } as unknown as React.PointerEvent);

    expect(result.current.selectionRect).toBeNull();
  });

  it("calls through to provided handlers", () => {
    const container = document.createElement("div");
    container.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
    (container as HTMLElement & { setPointerCapture?: (id: number) => void; releasePointerCapture?: (id: number) => void }).setPointerCapture = vi.fn();
    (container as HTMLElement & { releasePointerCapture?: (id: number) => void }).releasePointerCapture = vi.fn();
    const containerRef = { current: container };

    const onPointerDown = vi.fn();
    const onPointerMove = vi.fn();
    const onPointerUp = vi.fn();
    const onPointerLeave = vi.fn();

    const { result } = renderHook(() =>
      useSelectionBox(
        containerRef,
        800,
        600,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerLeave
      )
    );

    act(() => {
      result.current.handlePointerDown({
        button: 0,
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        target: container,
        buttons: 1,
      } as unknown as React.PointerEvent);
    });
    expect(onPointerDown).toHaveBeenCalled();

    act(() => {
      result.current.handlePointerMove({
        button: 0,
        buttons: 1,
        clientX: 10,
        clientY: 10,
        pointerId: 1,
        target: container,
      } as unknown as React.PointerEvent);
    });
    expect(onPointerMove).toHaveBeenCalled();

    act(() => {
      result.current.handlePointerUp({
        button: 0,
        buttons: 0,
        pointerId: 1,
        target: container,
      } as unknown as React.PointerEvent);
    });
    expect(onPointerUp).toHaveBeenCalled();

    act(() => {
      result.current.handlePointerLeave({
        buttons: 0,
        target: container,
      } as unknown as React.PointerEvent);
    });
    expect(onPointerLeave).toHaveBeenCalled();
  });
});
