import { useEffect, useState, RefObject } from "react";

export function useCanvasSize(
  containerRef: RefObject<HTMLElement | null>
): { width: number; height: number } {
  const [size, setSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = (w: number, h: number): void => {
      setSize({ width: Math.max(1, w), height: Math.max(1, h) });
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
