import { renderHook, act } from "@testing-library/react";
import { useRightButtonPanHandlers } from "./useRightButtonPanHandlers";

describe("useRightButtonPanHandlers", () => {
  it("returns isPanning false initially", () => {
    const setPanX = vi.fn();
    const setPanY = vi.fn();
    const { result } = renderHook(() => useRightButtonPanHandlers(setPanX, setPanY));

    expect(result.current.isPanning).toBe(false);
  });

  it("ignores pointer down with left button", () => {
    const setPanX = vi.fn();
    const setPanY = vi.fn();
    const { result } = renderHook(() => useRightButtonPanHandlers(setPanX, setPanY));

    const el = document.createElement("div");
    const captureSpy = vi.fn();
    el.setPointerCapture = captureSpy;

    result.current.onPointerDown({
      button: 0,
      clientX: 0,
      clientY: 0,
      pointerId: 1,
      target: el,
    } as unknown as React.PointerEvent);

    expect(captureSpy).not.toHaveBeenCalled();
  });

  it("starts panning on right-button pointer down and updates pan on move", () => {
    const setPanX = vi.fn();
    const setPanY = vi.fn();
    const { result, rerender } = renderHook(() => useRightButtonPanHandlers(setPanX, setPanY));

    const el = document.createElement("div");
    el.setPointerCapture = vi.fn();
    el.releasePointerCapture = vi.fn();

    act(() => {
      result.current.onPointerDown({
        button: 2,
        clientX: 100,
        clientY: 200,
        pointerId: 1,
        target: el,
        buttons: 4,
      } as unknown as React.PointerEvent);
    });
    rerender();

    act(() => {
      result.current.onPointerMove({
        button: 2,
        buttons: 4,
        clientX: 150,
        clientY: 250,
        pointerId: 1,
        target: el,
      } as unknown as React.PointerEvent);
    });
    rerender();

    expect(setPanX).toHaveBeenCalledWith(expect.any(Function));
    expect(setPanY).toHaveBeenCalledWith(expect.any(Function));
    expect(result.current.isPanning).toBe(true);
  });

  it("stops panning on pointer up with right button", () => {
    const setPanX = vi.fn();
    const setPanY = vi.fn();
    const { result, rerender } = renderHook(() => useRightButtonPanHandlers(setPanX, setPanY));

    const el = document.createElement("div");
    el.setPointerCapture = vi.fn();
    el.releasePointerCapture = vi.fn();

    act(() => {
      result.current.onPointerDown({
        button: 2,
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        target: el,
        buttons: 4,
      } as unknown as React.PointerEvent);
      result.current.onPointerMove({
        button: 2,
        buttons: 4,
        clientX: 10,
        clientY: 10,
        pointerId: 1,
        target: el,
      } as unknown as React.PointerEvent);
    });
    rerender();
    expect(result.current.isPanning).toBe(true);

    act(() => {
      result.current.onPointerUp({
        button: 2,
        buttons: 0,
        pointerId: 1,
        target: el,
      } as unknown as React.PointerEvent);
    });
    rerender();

    expect(result.current.isPanning).toBe(false);
  });

  it("calls onContextMenu without preventing default when not moved", () => {
    const setPanX = vi.fn();
    const setPanY = vi.fn();
    const { result } = renderHook(() => useRightButtonPanHandlers(setPanX, setPanY));

    const e = new MouseEvent("contextmenu", { bubbles: true, button: 2 });
    Object.defineProperty(e, "preventDefault", { value: vi.fn() });
    result.current.onContextMenu(e as unknown as React.MouseEvent);

    expect((e as MouseEvent & { preventDefault: () => void }).preventDefault).not.toHaveBeenCalled();
  });
});
