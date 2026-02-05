import { renderHook } from "@testing-library/react";
import { useWheelZoomHandlers } from "./useWheelZoomHandlers";

describe("useWheelZoomHandlers", () => {
  it("returns handleWheelRaw and onWheel", () => {
    const containerRef = { current: document.createElement("div") };
    containerRef.current.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
    const stateRef = { current: { panX: 0, panY: 0, zoom: 1 } };
    const setZoom = vi.fn();
    const setPanX = vi.fn();
    const setPanY = vi.fn();

    const { result } = renderHook(() =>
      useWheelZoomHandlers(
        containerRef,
        stateRef,
        setZoom,
        setPanX,
        setPanY,
        { minZoom: 0.1, maxZoom: 5, zoomSensitivity: 0.001 }
      )
    );

    expect(typeof result.current.handleWheelRaw).toBe("function");
    expect(typeof result.current.onWheel).toBe("function");
  });

  it("handleWheelRaw updates zoom and pan when wheel data provided", () => {
    const container = document.createElement("div");
    container.getBoundingClientRect = () =>
      ({ left: 100, top: 100, width: 800, height: 600 } as DOMRect);
    const containerRef = { current: container };
    const stateRef = { current: { panX: 0, panY: 0, zoom: 1 } };
    const setZoom = vi.fn();
    const setPanX = vi.fn();
    const setPanY = vi.fn();

    const { result } = renderHook(() =>
      useWheelZoomHandlers(
        containerRef,
        stateRef,
        setZoom,
        setPanX,
        setPanY,
        { minZoom: 0.1, maxZoom: 5, zoomSensitivity: 0.001 }
      )
    );

    result.current.handleWheelRaw({
      clientX: 100,
      clientY: 100,
      deltaY: -100,
    });

    expect(setZoom).toHaveBeenCalled();
    expect(setPanX).toHaveBeenCalled();
    expect(setPanY).toHaveBeenCalled();
  });

  it("handleWheelRaw does nothing when containerRef.current is null", () => {
    const containerRef = { current: null as HTMLElement | null };
    const stateRef = { current: { panX: 0, panY: 0, zoom: 1 } };
    const setZoom = vi.fn();
    const setPanX = vi.fn();
    const setPanY = vi.fn();

    const { result } = renderHook(() =>
      useWheelZoomHandlers(
        containerRef,
        stateRef,
        setZoom,
        setPanX,
        setPanY,
        { minZoom: 0.1, maxZoom: 5, zoomSensitivity: 0.001 }
      )
    );

    result.current.handleWheelRaw({
      clientX: 100,
      clientY: 100,
      deltaY: -100,
    });

    expect(setZoom).not.toHaveBeenCalled();
    expect(setPanX).not.toHaveBeenCalled();
    expect(setPanY).not.toHaveBeenCalled();
  });

  it("onWheel prevents default and invokes handleWheelRaw", () => {
    const container = document.createElement("div");
    container.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 600 } as DOMRect);
    const containerRef = { current: container };
    const stateRef = { current: { panX: 0, panY: 0, zoom: 1 } };
    const setZoom = vi.fn();
    const setPanX = vi.fn();
    const setPanY = vi.fn();

    const { result } = renderHook(() =>
      useWheelZoomHandlers(
        containerRef,
        stateRef,
        setZoom,
        setPanX,
        setPanY,
        { minZoom: 0.1, maxZoom: 5, zoomSensitivity: 0.001 }
      )
    );

    const preventDefault = vi.fn();
    const wheelEvent = {
      clientX: 50,
      clientY: 50,
      deltaY: -10,
      preventDefault,
    } as unknown as React.WheelEvent;

    result.current.onWheel(wheelEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(setZoom).toHaveBeenCalled();
  });
});
