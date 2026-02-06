/**
 * Resize handle ids and logic for selection box.
 * Resize is the single source of bounds during drag; output is always sanitized.
 */

import { sanitizeElementBounds, type ElementBounds } from "./elementBounds";

export const RESIZE_HANDLE_IDS = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
] as const;

export type ResizeHandleId = (typeof RESIZE_HANDLE_IDS)[number];

const MIN_SIZE = 10;

function clampSize(size: number): number {
  const n = Number(size);
  return Math.max(MIN_SIZE, Number.isFinite(n) ? n : MIN_SIZE);
}

function finiteNum(value: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Compute new bounds from start bounds, handle id, and world-space delta.
 * Enforces minimum width/height. Tolerates invalid start bounds (NaN/undefined).
 */
export function resizeBoundsFromHandle(
  start: ElementBounds,
  handleId: ResizeHandleId,
  dx: number,
  dy: number
): ElementBounds {
  let x = finiteNum(start.x, 0);
  let y = finiteNum(start.y, 0);
  let width = clampSize(start.width);
  let height = clampSize(start.height);

  switch (handleId) {
    case "e":
      width = clampSize(width + dx);
      break;
    case "w": {
      const newWidth = clampSize(width - dx);
      x = x + width - newWidth;
      width = newWidth;
      break;
    }
    case "s":
      height = clampSize(height + dy);
      break;
    case "n": {
      const newHeight = clampSize(height - dy);
      y = y + height - newHeight;
      height = newHeight;
      break;
    }
    case "ne": {
      width = clampSize(width + dx);
      const newHeight = clampSize(height - dy);
      y = y + height - newHeight;
      height = newHeight;
      break;
    }
    case "nw": {
      const newWidth = clampSize(width - dx);
      x = x + width - newWidth;
      width = newWidth;
      const newHeight = clampSize(height - dy);
      y = y + height - newHeight;
      height = newHeight;
      break;
    }
    case "se":
      width = clampSize(width + dx);
      height = clampSize(height + dy);
      break;
    case "sw": {
      const newWidth = clampSize(width - dx);
      x = x + width - newWidth;
      width = newWidth;
      height = clampSize(height + dy);
      break;
    }
  }

  return sanitizeElementBounds({ x, y, width, height });
}

/** Cursor style per handle. */
export const RESIZE_HANDLE_CURSORS: Record<ResizeHandleId, string> = {
  n: "n-resize",
  s: "s-resize",
  e: "e-resize",
  w: "w-resize",
  ne: "ne-resize",
  nw: "nw-resize",
  se: "se-resize",
  sw: "sw-resize",
};
