/**
 * Convert client coordinates to SVG viewBox coordinates.
 * Uses container rect and viewBox dimensions so coordinates align with the SVG.
 * Returns null if element is missing or any dimension is non-positive.
 */
export function clientToViewBox(
  el: HTMLElement | null,
  clientX: number,
  clientY: number,
  viewBoxWidth: number,
  viewBoxHeight: number
): { x: number; y: number } | null {
  if (!el || viewBoxWidth <= 0 || viewBoxHeight <= 0) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const scaleX = viewBoxWidth / rect.width;
  const scaleY = viewBoxHeight / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}
