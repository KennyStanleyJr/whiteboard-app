import { renderHook, act } from "@testing-library/react";
import { usePanZoom } from "./usePanZoom";

describe("usePanZoom", () => {
  it("returns initial state", () => {
    const { result } = renderHook(() => usePanZoom());

    expect(result.current.panX).toBe(0);
    expect(result.current.panY).toBe(0);
    expect(result.current.zoom).toBe(1);
    expect(result.current.isPanning).toBe(false);
    expect(result.current.containerRef).toEqual({ current: null });
  });

  it("returns all required handlers", () => {
    const { result } = renderHook(() => usePanZoom());

    expect(typeof result.current.handleWheelRaw).toBe("function");
    expect(typeof result.current.handleTouchStart).toBe("function");
    expect(typeof result.current.handleTouchMove).toBe("function");
    expect(typeof result.current.handleTouchEnd).toBe("function");
    expect(typeof result.current.onContextMenu).toBe("function");
    expect(typeof result.current.onPointerDown).toBe("function");
    expect(typeof result.current.onPointerMove).toBe("function");
    expect(typeof result.current.onPointerUp).toBe("function");
    expect(typeof result.current.onPointerLeave).toBe("function");
    expect(typeof result.current.onWheel).toBe("function");
  });

  it("accepts custom options", () => {
    const { result } = renderHook(() =>
      usePanZoom({ minZoom: 0.5, maxZoom: 3, zoomSensitivity: 0.002 })
    );

    expect(result.current.zoom).toBe(1);
  });

  it("handleWheelRaw updates zoom when container has dimensions", () => {
    const container = document.createElement("div");
    container.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
    document.body.appendChild(container);

    const { result } = renderHook(() => usePanZoom());

    (result.current.containerRef as { current: HTMLElement | null }).current =
      container;

    act(() => {
      result.current.handleWheelRaw({
        clientX: 400,
        clientY: 300,
        deltaY: -100,
      });
    });

    expect(result.current.zoom).toBeGreaterThan(1);

    document.body.removeChild(container);
  });
});
