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

export interface ResizeModifiers {
  /** Keep aspect ratio (width/height) from start bounds. */
  shiftKey?: boolean;
  /** Scale from center: keep center position fixed. */
  ctrlKey?: boolean;
}

/**
 * Compute new bounds from start bounds, handle id, and world-space delta.
 * Enforces minimum width/height. Tolerates invalid start bounds (NaN/undefined).
 * With shiftKey: preserves aspect ratio. With ctrlKey: preserves center position.
 */
export function resizeBoundsFromHandle(
  start: ElementBounds,
  handleId: ResizeHandleId,
  dx: number,
  dy: number,
  modifiers?: ResizeModifiers
): ElementBounds {
  let x = finiteNum(start.x, 0);
  let y = finiteNum(start.y, 0);
  let width = clampSize(start.width);
  let height = clampSize(start.height);
  const aspectRatio = width / height;

  switch (handleId) {
    case "e":
      width = clampSize(width + dx);
      if (modifiers?.shiftKey) {
        const newHeight = clampSize(width / aspectRatio);
        y = y + (height - newHeight) / 2;
        height = newHeight;
      }
      break;
    case "w": {
      const newWidth = clampSize(width - dx);
      x = x + width - newWidth;
      width = newWidth;
      if (modifiers?.shiftKey) {
        const newHeight = clampSize(width / aspectRatio);
        y = y + (height - newHeight) / 2;
        height = newHeight;
      }
      break;
    }
    case "s":
      height = clampSize(height + dy);
      if (modifiers?.shiftKey) {
        const newWidth = clampSize(height * aspectRatio);
        x = x + (width - newWidth) / 2;
        width = newWidth;
      }
      break;
    case "n": {
      const newHeight = clampSize(height - dy);
      y = y + height - newHeight;
      height = newHeight;
      if (modifiers?.shiftKey) {
        const newWidth = clampSize(height * aspectRatio);
        x = x + (width - newWidth) / 2;
        width = newWidth;
      }
      break;
    }
    case "ne": {
      width = clampSize(width + dx);
      let newHeight = clampSize(height - dy);
      if (modifiers?.shiftKey) {
        newHeight = clampSize(width / aspectRatio);
      }
      y = y + height - newHeight;
      height = newHeight;
      break;
    }
    case "nw": {
      let newWidth = clampSize(width - dx);
      let newHeight = clampSize(height - dy);
      if (modifiers?.shiftKey) {
        const scale = Math.max(newWidth / width, newHeight / height);
        newWidth = clampSize(width * scale);
        newHeight = clampSize(height * scale);
      }
      x = x + width - newWidth;
      y = y + height - newHeight;
      width = newWidth;
      height = newHeight;
      break;
    }
    case "se": {
      let newWidthSe = clampSize(width + dx);
      let newHeightSe = clampSize(height + dy);
      if (modifiers?.shiftKey) {
        const scale = Math.max(newWidthSe / width, newHeightSe / height);
        newWidthSe = clampSize(width * scale);
        newHeightSe = clampSize(height * scale);
      }
      width = newWidthSe;
      height = newHeightSe;
      break;
    }
    case "sw": {
      let newWidthSw = clampSize(width - dx);
      let newHeightSw = clampSize(height + dy);
      if (modifiers?.shiftKey) {
        const scale = Math.max(newWidthSw / width, newHeightSw / height);
        newWidthSw = clampSize(width * scale);
        newHeightSw = clampSize(height * scale);
      }
      x = x + width - newWidthSw;
      width = newWidthSw;
      height = newHeightSw;
      break;
    }
  }

  let result = { x, y, width, height };
  // Apply ctrlKey (center preservation) only when shiftKey is not pressed.
  // When both are pressed, shiftKey's axis-specific anchoring takes precedence
  // to avoid ctrlKey overriding the intended behavior.
  if (modifiers?.ctrlKey && !modifiers?.shiftKey) {
    const centerX = finiteNum(start.x, 0) + clampSize(start.width) / 2;
    const centerY = finiteNum(start.y, 0) + clampSize(start.height) / 2;
    result = {
      x: centerX - result.width / 2,
      y: centerY - result.height / 2,
      width: result.width,
      height: result.height,
    };
  }
  return sanitizeElementBounds(result);
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
