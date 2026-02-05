import { renderHook } from "@testing-library/react";
import { useCanvasEventListeners } from "./useCanvasEventListeners";

describe("useCanvasEventListeners", () => {
  it("adds and removes wheel listener on mount/unmount", () => {
    const handleWheelRaw = vi.fn();
    const handleTouchStart = vi.fn();
    const handleTouchMove = vi.fn();
    const handleTouchEnd = vi.fn();

    const container = document.createElement("div");
    document.body.appendChild(container);
    const ref = { current: container };

    const addSpy = vi.spyOn(container, "addEventListener");
    const removeSpy = vi.spyOn(container, "removeEventListener");

    const { unmount } = renderHook(() =>
      useCanvasEventListeners(
        ref,
        handleWheelRaw,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd
      )
    );

    expect(addSpy).toHaveBeenCalledWith("wheel", expect.any(Function), { passive: false });
    expect(addSpy).toHaveBeenCalledWith("touchstart", handleTouchStart, { passive: true });
    expect(addSpy).toHaveBeenCalledWith("touchmove", handleTouchMove, { passive: false });
    expect(addSpy).toHaveBeenCalledWith("touchend", handleTouchEnd, { passive: true });
    expect(addSpy).toHaveBeenCalledWith("touchcancel", handleTouchEnd, { passive: true });

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("wheel", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("touchstart", handleTouchStart);
    expect(removeSpy).toHaveBeenCalledWith("touchmove", handleTouchMove);
    expect(removeSpy).toHaveBeenCalledWith("touchend", handleTouchEnd);
    expect(removeSpy).toHaveBeenCalledWith("touchcancel", handleTouchEnd);

    document.body.removeChild(container);
  });

  it("calls handleWheelRaw when wheel event fires", () => {
    const handleWheelRaw = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const ref = { current: container };

    renderHook(() =>
      useCanvasEventListeners(ref, handleWheelRaw, vi.fn(), vi.fn(), vi.fn())
    );

    const wheelEvent = new WheelEvent("wheel", { deltaY: -50 });
    Object.defineProperty(wheelEvent, "clientX", { value: 100 });
    Object.defineProperty(wheelEvent, "clientY", { value: 200 });
    container.dispatchEvent(wheelEvent);

    expect(handleWheelRaw).toHaveBeenCalledWith({
      clientX: 100,
      clientY: 200,
      deltaY: -50,
    });

    document.body.removeChild(container);
  });
});
