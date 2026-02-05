/**
 * Pure helpers and constants for pan/zoom and touch gestures.
 * Extracted to keep usePanZoom within ~60-line guideline.
 */

export const MIN_ZOOM = 0.1;

export interface WheelData {
  clientX: number;
  clientY: number;
  deltaY: number;
}

export const MAX_ZOOM = 5;
export const ZOOM_SENSITIVITY = 0.001;

export const TAP_MAX_DURATION_MS = 400;
export const TAP_MAX_MOVE_PX = 15;
export const TAP_MAX_SCALE_CHANGE = 0.05;

export function clampZoom(zoom: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, zoom));
}

export function touchCenterAndDistance(
  touches: TouchList
): { cx: number; cy: number; dist: number } {
  const t0 = touches[0];
  const t1 = touches[1];
  if (t0 == null || t1 == null) {
    return { cx: 0, cy: 0, dist: 1 };
  }
  const x1 = t0.clientX;
  const y1 = t0.clientY;
  const x2 = t1.clientX;
  const y2 = t1.clientY;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const dist = Math.hypot(x2 - x1, y2 - y1) || 1;
  return { cx, cy, dist };
}

/** Zoom-at-point: compute new pan so the world point under (cursorX, cursorY) stays fixed. */
export function zoomAtPoint(
  cursorX: number,
  cursorY: number,
  panX: number,
  panY: number,
  zoom: number,
  nextZoom: number
): { panX: number; panY: number } {
  const worldX = (cursorX - panX) / zoom;
  const worldY = (cursorY - panY) / zoom;
  return {
    panX: cursorX - worldX * nextZoom,
    panY: cursorY - worldY * nextZoom,
  };
}

export interface TouchGestureState {
  centerX: number;
  centerY: number;
  distance: number;
  panX: number;
  panY: number;
  zoom: number;
  startTime: number;
  movedEnough: boolean;
}

/** Compute next pan/zoom from a two-finger touch move. */
export function applyTouchPinch(
  g: TouchGestureState,
  cx: number,
  cy: number,
  dist: number,
  minZoom: number,
  maxZoom: number
): { nextZoom: number; nextPanX: number; nextPanY: number } {
  const scale = dist / g.distance;
  const nextZoom = clampZoom(g.zoom * scale, minZoom, maxZoom);
  const worldX = (g.centerX - g.panX) / g.zoom;
  const worldY = (g.centerY - g.panY) / g.zoom;
  return {
    nextZoom,
    nextPanX: cx - worldX * nextZoom,
    nextPanY: cy - worldY * nextZoom,
  };
}

/** Check if two-finger gesture counts as a tap (show context menu). */
export function isTwoFingerTap(
  g: TouchGestureState,
  durationMs: number
): boolean {
  return !g.movedEnough && durationMs < TAP_MAX_DURATION_MS;
}

/** Build initial touch gesture state from current pan/zoom and touch center. */
export function createTouchGestureState(
  cx: number,
  cy: number,
  dist: number,
  panX: number,
  panY: number,
  zoom: number
): TouchGestureState {
  return {
    centerX: cx,
    centerY: cy,
    distance: dist,
    panX,
    panY,
    zoom,
    startTime: Date.now(),
    movedEnough: false,
  };
}
