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
 * With shiftKey: preserves aspect ratio (from start or fixed). With ctrlKey: preserves center position.
 * When fixedAspectRatio is provided (e.g. text fill mode), aspect is always locked to that ratio.
 */
export function resizeBoundsFromHandle(
  start: ElementBounds,
  handleId: ResizeHandleId,
  dx: number,
  dy: number,
  modifiers?: ResizeModifiers,
  fixedAspectRatio?: number
): ElementBounds {
  let x = finiteNum(start.x, 0);
  let y = finiteNum(start.y, 0);
  let width = clampSize(start.width);
  let height = clampSize(start.height);
  const useFixedRatio =
    fixedAspectRatio != null &&
    Number.isFinite(fixedAspectRatio) &&
    fixedAspectRatio > 0;
  const aspectRatio = useFixedRatio ? fixedAspectRatio : width / height;
  const lockAspect = useFixedRatio || modifiers?.shiftKey;

  switch (handleId) {
    case "e":
      width = clampSize(width + dx);
      if (lockAspect) {
        const newHeight = clampSize(width / aspectRatio);
        y = y + (height - newHeight) / 2;
        height = newHeight;
      }
      break;
    case "w": {
      const newWidth = clampSize(width - dx);
      x = x + width - newWidth;
      width = newWidth;
      if (lockAspect) {
        const newHeight = clampSize(width / aspectRatio);
        y = y + (height - newHeight) / 2;
        height = newHeight;
      }
      break;
    }
    case "s":
      height = clampSize(height + dy);
      if (lockAspect) {
        const newWidth = clampSize(height * aspectRatio);
        x = x + (width - newWidth) / 2;
        width = newWidth;
      }
      break;
    case "n": {
      const newHeight = clampSize(height - dy);
      y = y + height - newHeight;
      height = newHeight;
      if (lockAspect) {
        const newWidth = clampSize(height * aspectRatio);
        x = x + (width - newWidth) / 2;
        width = newWidth;
      }
      break;
    }
    case "ne": {
      width = clampSize(width + dx);
      let newHeight = clampSize(height - dy);
      if (lockAspect) {
        newHeight = clampSize(width / aspectRatio);
      }
      y = y + height - newHeight;
      height = newHeight;
      break;
    }
    case "nw": {
      let newWidth = clampSize(width - dx);
      let newHeight = clampSize(height - dy);
      if (lockAspect) {
        if (useFixedRatio) {
          const desiredW = newWidth;
          const desiredH = newHeight;
          if (desiredW / aspectRatio <= desiredH) {
            newWidth = clampSize(desiredW);
            newHeight = clampSize(desiredW / aspectRatio);
          } else {
            newHeight = clampSize(desiredH);
            newWidth = clampSize(desiredH * aspectRatio);
          }
        } else {
          const scale = Math.max(newWidth / width, newHeight / height);
          newWidth = clampSize(width * scale);
          newHeight = clampSize(height * scale);
        }
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
      if (lockAspect) {
        if (useFixedRatio) {
          const desiredW = clampSize(width + dx);
          const desiredH = clampSize(height + dy);
          if (desiredW / aspectRatio <= desiredH) {
            newWidthSe = desiredW;
            newHeightSe = clampSize(desiredW / aspectRatio);
          } else {
            newHeightSe = desiredH;
            newWidthSe = clampSize(desiredH * aspectRatio);
          }
        } else {
          const scale = Math.max(newWidthSe / width, newHeightSe / height);
          newWidthSe = clampSize(width * scale);
          newHeightSe = clampSize(height * scale);
        }
      }
      width = newWidthSe;
      height = newHeightSe;
      break;
    }
    case "sw": {
      let newWidthSw = clampSize(width - dx);
      let newHeightSw = clampSize(height + dy);
      if (lockAspect) {
        if (useFixedRatio) {
          const desiredW = newWidthSw;
          const desiredH = newHeightSw;
          if (desiredW / aspectRatio <= desiredH) {
            newWidthSw = clampSize(desiredW);
            newHeightSw = clampSize(desiredW / aspectRatio);
          } else {
            newHeightSw = clampSize(desiredH);
            newWidthSw = clampSize(desiredH * aspectRatio);
          }
        } else {
          const scale = Math.max(newWidthSw / width, newHeightSw / height);
          newWidthSw = clampSize(width * scale);
          newHeightSw = clampSize(height * scale);
        }
      }
      x = x + width - newWidthSw;
      width = newWidthSw;
      height = newHeightSw;
      break;
    }
  }

  let result = { x, y, width, height };
  // Apply ctrlKey (center preservation) when pressed.
  // When both shiftKey and ctrlKey are pressed, both behaviors apply:
  // shiftKey preserves aspect ratio, ctrlKey preserves center position.
  if (modifiers?.ctrlKey) {
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

/**
 * Clamp bounds to a maximum size while preserving handle-relative position.
 * Used for text fill mode where the box cannot exceed the fitted content size.
 */
export function clampBoundsToMax(
  bounds: ElementBounds,
  max: { width: number; height: number },
  handleId: ResizeHandleId
): ElementBounds {
  const scale = Math.min(
    1,
    max.width / bounds.width,
    max.height / bounds.height
  );
  if (scale >= 1) return bounds;
  const newW = bounds.width * scale;
  const newH = bounds.height * scale;
  const { x: bx, y: by, width: bw, height: bh } = bounds;
  let x: number;
  let y: number;
  switch (handleId) {
    case "se":
      x = bx;
      y = by;
      break;
    case "sw":
      x = bx + bw - newW;
      y = by;
      break;
    case "nw":
      x = bx + bw - newW;
      y = by + bh - newH;
      break;
    case "ne":
      x = bx;
      y = by + bh - newH;
      break;
    case "e":
      x = bx;
      y = by + (bh - newH) / 2;
      break;
    case "w":
      x = bx + bw - newW;
      y = by + (bh - newH) / 2;
      break;
    case "s":
      x = bx + (bw - newW) / 2;
      y = by;
      break;
    case "n":
      x = bx + (bw - newW) / 2;
      y = by + bh - newH;
      break;
    default:
      x = bx;
      y = by;
  }
  return sanitizeElementBounds({ x, y, width: newW, height: newH });
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
