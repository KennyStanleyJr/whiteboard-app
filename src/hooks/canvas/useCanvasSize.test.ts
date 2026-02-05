import { renderHook } from "@testing-library/react";
import { useCanvasSize } from "./useCanvasSize";

describe("useCanvasSize", () => {
  let disconnect: ReturnType<typeof vi.fn>;
  let observe: ReturnType<typeof vi.fn>;
  let captureCallback: ResizeObserverCallback | null = null;

  beforeEach(() => {
    disconnect = vi.fn();
    observe = vi.fn(() => {
      if (captureCallback) {
        captureCallback(
          [{ contentRect: { width: 800, height: 600 } } as ResizeObserverEntry],
          {} as ResizeObserver
        );
      }
    });

    global.ResizeObserver = class MockResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        captureCallback = callback;
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
    };
  });

  it("updates size from ResizeObserver callback", () => {
    const ref = { current: document.createElement("div") };
    const { result } = renderHook(() => useCanvasSize(ref));

    expect(result.current.width).toBe(800);
    expect(result.current.height).toBe(600);
  });

  it("clamps size to at least 1", () => {
    global.ResizeObserver = class MockResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        this._callback = callback;
      }
      _callback!: ResizeObserverCallback;
      observe = vi.fn(() => {
        this._callback(
          [{ contentRect: { width: 0, height: 0 } } as ResizeObserverEntry],
          {} as ResizeObserver
        );
      });
      disconnect = vi.fn();
      unobserve = vi.fn();
    };

    const ref = { current: document.createElement("div") };
    const { result } = renderHook(() => useCanvasSize(ref));

    expect(result.current.width).toBe(1);
    expect(result.current.height).toBe(1);
  });

  it("disconnects ResizeObserver on unmount", () => {
    const ref = { current: document.createElement("div") };
    const { unmount } = renderHook(() => useCanvasSize(ref));
    unmount();

    expect(disconnect).toHaveBeenCalled();
  });
});
