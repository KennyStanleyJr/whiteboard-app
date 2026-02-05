import { renderHook } from "@testing-library/react";
import { useCanvasSize } from "./useCanvasSize";

describe("useCanvasSize", () => {
  let disconnectMock: () => void;
  let observeMock: (target: Element, options?: ResizeObserverOptions) => void;
  let captureCallback: ResizeObserverCallback | null = null;

  beforeEach(() => {
    disconnectMock = vi.fn();
    observeMock = vi.fn(() => {
      if (captureCallback) {
        captureCallback(
          [{ contentRect: { width: 800, height: 600 } } as ResizeObserverEntry],
          {} as ResizeObserver
        );
      }
    });

    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        captureCallback = callback;
      }
      observe(target: Element, options?: ResizeObserverOptions): void {
        observeMock(target, options);
      }
      unobserve(): void {
        // no-op for tests
      }
      disconnect(): void {
        disconnectMock();
      }
    }

    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  });

  it("updates size from ResizeObserver callback", () => {
    const ref = { current: document.createElement("div") };
    const { result } = renderHook(() => useCanvasSize(ref));

    expect(result.current.width).toBe(800);
    expect(result.current.height).toBe(600);
  });

  it("clamps size to at least 1", () => {
    class MockResizeObserver {
      private _callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this._callback = callback;
      }
      observe(): void {
        this._callback(
          [{ contentRect: { width: 0, height: 0 } } as ResizeObserverEntry],
          {} as ResizeObserver
        );
      }
      unobserve(): void {
        // no-op
      }
      disconnect(): void {
        // no-op
      }
    }

    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    const ref = { current: document.createElement("div") };
    const { result } = renderHook(() => useCanvasSize(ref));

    expect(result.current.width).toBe(1);
    expect(result.current.height).toBe(1);
  });

  it("disconnects ResizeObserver on unmount", () => {
    const ref = { current: document.createElement("div") };
    const { unmount } = renderHook(() => useCanvasSize(ref));
    unmount();

    expect(disconnectMock).toHaveBeenCalled();
  });
});
