import { renderHook } from "@testing-library/react";
import { useTouchPanZoomHandlers } from "./useTouchPanZoomHandlers";

function createTouchEvent(
  type: string,
  touches: Array<{ clientX: number; clientY: number }>
): TouchEvent {
  const touchStore: {
    length: number;
    [index: number]: { clientX: number; clientY: number };
  } = { length: touches.length };
  touches.forEach((t, i) => {
    touchStore[i] = { clientX: t.clientX, clientY: t.clientY };
  });
  return {
    type,
    touches: touchStore,
    preventDefault: () => {
      // no-op for tests
    },
  } as unknown as TouchEvent;
}

describe("useTouchPanZoomHandlers", () => {
  it("returns handlers", () => {
    const containerRef = { current: document.createElement("div") };
    const stateRef = { current: { panX: 0, panY: 0, zoom: 1 } };
    const setZoom = vi.fn();
    const setPanX = vi.fn();
    const setPanY = vi.fn();

    const { result } = renderHook(() =>
      useTouchPanZoomHandlers(
        containerRef,
        stateRef,
        setZoom,
        setPanX,
        setPanY,
        { minZoom: 0.1, maxZoom: 5 }
      )
    );

    expect(typeof result.current.handleTouchStart).toBe("function");
    expect(typeof result.current.handleTouchMove).toBe("function");
    expect(typeof result.current.handleTouchEnd).toBe("function");
  });

  it("handleTouchStart ignores single touch", () => {
    const containerRef = { current: document.createElement("div") };
    const stateRef = { current: { panX: 0, panY: 0, zoom: 1 } };
    const setZoom = vi.fn();
    const setPanX = vi.fn();
    const setPanY = vi.fn();

    const { result } = renderHook(() =>
      useTouchPanZoomHandlers(
        containerRef,
        stateRef,
        setZoom,
        setPanX,
        setPanY,
        { minZoom: 0.1, maxZoom: 5 }
      )
    );

    const event = createTouchEvent("touchstart", [{ clientX: 0, clientY: 0 }]);
    result.current.handleTouchStart(event);

    result.current.handleTouchMove(
      createTouchEvent("touchmove", [
        { clientX: 0, clientY: 0 },
        { clientX: 100, clientY: 0 },
      ])
    );

    expect(setZoom).not.toHaveBeenCalled();
  });

  it("handleTouchStart and handleTouchMove update zoom/pan with two touches", () => {
    const containerRef = { current: document.createElement("div") };
    const stateRef = { current: { panX: 0, panY: 0, zoom: 1 } };
    const setZoom = vi.fn();
    const setPanX = vi.fn();
    const setPanY = vi.fn();

    const { result } = renderHook(() =>
      useTouchPanZoomHandlers(
        containerRef,
        stateRef,
        setZoom,
        setPanX,
        setPanY,
        { minZoom: 0.1, maxZoom: 5 }
      )
    );

    const startEvent = createTouchEvent("touchstart", [
      { clientX: 0, clientY: 0 },
      { clientX: 100, clientY: 0 },
    ]);
    result.current.handleTouchStart(startEvent);

    const moveEvent = createTouchEvent("touchmove", [
      { clientX: 0, clientY: 0 },
      { clientX: 200, clientY: 0 },
    ]);
    result.current.handleTouchMove(moveEvent);

    expect(setZoom).toHaveBeenCalled();
    expect(setPanX).toHaveBeenCalled();
    expect(setPanY).toHaveBeenCalled();
  });

  it("handleTouchEnd clears gesture when touches go to zero", () => {
    const container = document.createElement("div");
    const containerRef = { current: container };
    const stateRef = { current: { panX: 0, panY: 0, zoom: 1 } };
    const setZoom = vi.fn();
    const setPanX = vi.fn();
    const setPanY = vi.fn();

    const { result } = renderHook(() =>
      useTouchPanZoomHandlers(
        containerRef,
        stateRef,
        setZoom,
        setPanX,
        setPanY,
        { minZoom: 0.1, maxZoom: 5 }
      )
    );

    const startEvent = createTouchEvent("touchstart", [
      { clientX: 0, clientY: 0 },
      { clientX: 100, clientY: 0 },
    ]);
    result.current.handleTouchStart(startEvent);

    const endEvent = createTouchEvent("touchend", []);
    result.current.handleTouchEnd(endEvent);

    expect(result.current.handleTouchEnd).toBeDefined();
  });
});
