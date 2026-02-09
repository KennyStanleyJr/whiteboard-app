/** Minimum zoom used when zoom is invalid or zero; keeps overlay and elements in sync. */
export const MIN_ZOOM = 0.001;

/** Clamp zoom to a valid positive value; invalid/zero becomes MIN_ZOOM. */
export function clampZoom(zoom: number): number {
  return Math.max(
    Number.isFinite(zoom) && zoom > 0 ? zoom : MIN_ZOOM,
    MIN_ZOOM
  );
}

/**
 * Convert client coordinates to SVG viewBox coordinates.
 * Uses container rect and viewBox dimensions so coordinates align with the SVG.
 * Returns null if element is missing or any dimension is non-positive.
 */
export function clientToViewBox(
  el: Element | null,
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

/**
 * Convert viewBox coordinates to world (canvas) coordinates using pan/zoom.
 * World coords are used for element positions inside the transformed group.
 */
export function viewBoxToWorld(
  viewBoxX: number,
  viewBoxY: number,
  panX: number,
  panY: number,
  zoom: number
): { x: number; y: number } {
  return {
    x: (viewBoxX - panX) / zoom,
    y: (viewBoxY - panY) / zoom,
  };
}

/**
 * Convert client coordinates to world (canvas) coordinates.
 * Returns null if clientToViewBox fails, zoom is invalid, or result would be non-finite.
 * Ensures callers never receive invalid world coordinates (e.g. from zoom 0).
 */
export function clientToWorld(
  el: Element | null,
  clientX: number,
  clientY: number,
  viewBoxWidth: number,
  viewBoxHeight: number,
  panX: number,
  panY: number,
  zoom: number
): { x: number; y: number } | null {
  if (!Number.isFinite(zoom) || zoom <= 0) return null;
  const vb = clientToViewBox(el, clientX, clientY, viewBoxWidth, viewBoxHeight);
  if (vb === null) return null;
  const world = viewBoxToWorld(vb.x, vb.y, panX, panY, zoom);
  if (
    !Number.isFinite(world.x) ||
    !Number.isFinite(world.y)
  ) return null;
  return world;
}

/**
 * Convert world (canvas) coordinates to viewBox coordinates.
 */
export function worldToViewBox(
  worldX: number,
  worldY: number,
  panX: number,
  panY: number,
  zoom: number
): { x: number; y: number } {
  return {
    x: worldX * zoom + panX,
    y: worldY * zoom + panY,
  };
}

/**
 * Convert viewBox coordinates to client coordinates relative to an element.
 * Returns null if element is missing or has non-positive dimensions.
 */
export function viewBoxToClient(
  el: Element | null,
  viewBoxX: number,
  viewBoxY: number,
  viewBoxWidth: number,
  viewBoxHeight: number
): { x: number; y: number } | null {
  if (!el || viewBoxWidth <= 0 || viewBoxHeight <= 0) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const scaleX = rect.width / viewBoxWidth;
  const scaleY = rect.height / viewBoxHeight;
  return {
    x: rect.left + viewBoxX * scaleX,
    y: rect.top + viewBoxY * scaleY,
  };
}

/**
 * Convert world coordinates to client coordinates.
 * Returns null if viewBoxToClient fails.
 */
export function worldToClient(
  el: Element | null,
  worldX: number,
  worldY: number,
  viewBoxWidth: number,
  viewBoxHeight: number,
  panX: number,
  panY: number,
  zoom: number
): { x: number; y: number } | null {
  const vb = worldToViewBox(worldX, worldY, panX, panY, zoom);
  return viewBoxToClient(el, vb.x, vb.y, viewBoxWidth, viewBoxHeight);
}
