import { useEffect, useReducer, RefObject } from "react";

/** Observed size; width/height are always at least 1 to avoid zero-dimension viewports. */
type SizeState = { width: number; height: number };
type SizeAction = { type: "SET"; payload: { width: number; height: number } };

function sizeReducer(state: SizeState, action: SizeAction): SizeState {
  if (action.type !== "SET") return state;
  const { width, height } = action.payload;
  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

const INITIAL_SIZE: SizeState = { width: 1, height: 1 };

/**
 * Subscribes to container size via ResizeObserver.
 * Returns { width, height } with a minimum of 1 to avoid zero-dimension layout issues.
 */
export function useCanvasSize(
  containerRef: RefObject<HTMLElement | null>
): { width: number; height: number } {
  const [size, dispatch] = useReducer(sizeReducer, INITIAL_SIZE);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = (w: number, h: number): void => {
      dispatch({ type: "SET", payload: { width: w, height: h } });
    };
    updateSize(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        updateSize(width, height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return size;
}
