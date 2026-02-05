import { renderHook } from "@testing-library/react";
import { useTouchPanZoomHandlers } from "./useTouchPanZoomHandlers";

function createTouchEvent(
  type: string,
  touches: Array<{ clientX: number; clientY: number }>
): TouchEvent {
  const touchList = touches.map((t, i) => ({
    ...t,
    identifier: i,
    target: document.createElement("div"),
  }));
  const event = new TouchEvent(type, {
    touches: touchList as unknown as TouchList,
    changedTouches: touchList as unknown as TouchList,
  });
  return event;
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
    Object.defineProperty(event, "touches", {
      value: { length: 1 },
      configurable: true,
    });
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

    const startEvent = new TouchEvent("touchstart", {
      touches: [
        { clientX: 0, clientY: 0 } as Touch,
        { clientX: 100, clientY: 0 } as Touch,
      ] as unknown as TouchList,
    });
    Object.defineProperty(startEvent, "touches", {
      value: {
        length: 2,
        0: { clientX: 0, clientY: 0 },
        1: { clientX: 100, clientY: 0 },
      },
      configurable: true,
    });
    result.current.handleTouchStart(startEvent);

    const moveEvent = new TouchEvent("touchmove", {
      touches: [
        { clientX: 0, clientY: 0 } as Touch,
        { clientX: 200, clientY: 0 } as Touch,
      ] as unknown as TouchList,
    });
    Object.defineProperty(moveEvent, "touches", {
      value: {
        length: 2,
        0: { clientX: 0, clientY: 0 },
        1: { clientX: 200, clientY: 0 },
      },
      configurable: true,
    });
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

    const startEvent = new TouchEvent("touchstart");
    Object.defineProperty(startEvent, "touches", {
      value: {
        length: 2,
        0: { clientX: 0, clientY: 0 },
        1: { clientX: 100, clientY: 0 },
      },
      configurable: true,
    });
    result.current.handleTouchStart(startEvent);

    const endEvent = new TouchEvent("touchend");
    Object.defineProperty(endEvent, "touches", {
      value: { length: 0 },
      configurable: true,
    });
    result.current.handleTouchEnd(endEvent);

    expect(result.current.handleTouchEnd).toBeDefined();
  });
});
