/**
 * Element bounds and hit-testing for whiteboard elements.
 * Shared constants and helpers so selection/rendering stay in sync.
 */

import type { WhiteboardElement } from "../types/whiteboard";

/** Width of text element box (matches SVG foreignObject). */
export const TEXT_EDIT_WIDTH = 280;
/** Height of text element box (slightly taller than font for descenders). */
export const TEXT_EDIT_HEIGHT = 22;
/** Initial foreignObject width when text has no size yet; large so content can size to text length (measurement then uses actual width). */
export const DEFAULT_UNMEASURED_TEXT_WIDTH = 20000;
/** Initial foreignObject height when text has no size yet, so layout can measure content height. */
export const DEFAULT_UNMEASURED_TEXT_HEIGHT = 10000;

const MIN_BOUNDS_SIZE = 1;

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MEASUREMENT_EPSILON = 0.5;

function finiteNum(value: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * True if two bounds are equal within MEASUREMENT_EPSILON.
 * Used to avoid measurement update loops (skipping redundant dispatches).
 */
export function boundsEqualWithinEpsilon(a: ElementBounds, b: ElementBounds): boolean {
  return (
    Math.abs(a.x - b.x) < MEASUREMENT_EPSILON &&
    Math.abs(a.y - b.y) < MEASUREMENT_EPSILON &&
    Math.abs(a.width - b.width) < MEASUREMENT_EPSILON &&
    Math.abs(a.height - b.height) < MEASUREMENT_EPSILON
  );
}

/**
 * Ensure bounds have finite numbers and positive width/height.
 * Prevents NaN/invalid values from propagating (e.g. during resize).
 */
export function sanitizeElementBounds(b: ElementBounds): ElementBounds {
  return {
    x: finiteNum(b.x, 0),
    y: finiteNum(b.y, 0),
    width: Math.max(MIN_BOUNDS_SIZE, finiteNum(b.width, TEXT_EDIT_WIDTH)),
    height: Math.max(MIN_BOUNDS_SIZE, finiteNum(b.height, TEXT_EDIT_HEIGHT)),
  };
}

/**
 * Return the bounding box of an element in world coordinates.
 * When measuredBounds is provided and has an entry for this element, use it (e.g. text wrapped to content).
 * Always returns sanitized bounds (finite numbers, positive size).
 */
export function getElementBounds(
  el: WhiteboardElement,
  measuredBounds?: Record<string, ElementBounds> | null
): ElementBounds {
  if (el.kind === "text") {
    const w = el.width;
    const h = el.height;
    if (w !== undefined && h !== undefined && w > 0 && h > 0) {
      /* Round position and size so selection box matches foreignObject (which uses rounded dims); fixes Safari misalignment. */
      return sanitizeElementBounds({
        x: Math.round(el.x),
        y: Math.round(el.y),
        width: Math.round(w),
        height: Math.round(h),
      });
    }
    const measured = measuredBounds?.[el.id];
    if (measured !== undefined) {
      /* Round position and dimensions so selection box matches foreignObject; consistent with stored measured bounds. */
      return sanitizeElementBounds({
        x: Math.round(el.x),
        y: Math.round(el.y),
        width: Math.round(measured.width),
        height: Math.round(measured.height),
      });
    }
    /* Round position so selection box matches foreignObject when no measured bounds yet (e.g. newly created text). */
    return sanitizeElementBounds({
      x: Math.round(el.x),
      y: Math.round(el.y),
      width: TEXT_EDIT_WIDTH,
      height: TEXT_EDIT_HEIGHT,
    });
  }
  if (el.kind === "shape") {
    return sanitizeElementBounds({
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
    });
  }
  if (el.kind === "image") {
    return sanitizeElementBounds({
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
    });
  }
  return sanitizeElementBounds({ x: 0, y: 0, width: 0, height: 0 });
}

function boundsContains(b: ElementBounds, wx: number, wy: number): boolean {
  return (
    wx >= b.x &&
    wx <= b.x + b.width &&
    wy >= b.y &&
    wy <= b.y + b.height
  );
}

function rectsOverlap(a: ElementBounds, b: ElementBounds): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * Return ids of elements whose bounds overlap the given world rect.
 * Used for marquee (drag) selection.
 */
export function elementsInRect(
  rect: ElementBounds,
  elements: WhiteboardElement[],
  measuredBounds?: Record<string, ElementBounds> | null
): string[] {
  const ids: string[] = [];
  for (const el of elements) {
    const b = getElementBounds(el, measuredBounds);
    if (rectsOverlap(rect, b)) ids.push(el.id);
  }
  return ids;
}

/**
 * Return the topmost element at (worldX, worldY), or null.
 * Elements are checked in reverse order (last in array = topmost).
 */
export function elementAtPoint(
  worldX: number,
  worldY: number,
  elements: WhiteboardElement[],
  measuredBounds?: Record<string, ElementBounds> | null
): WhiteboardElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el === undefined) continue;
    const b = getElementBounds(el, measuredBounds);
    if (boundsContains(b, worldX, worldY)) return el;
  }
  return null;
}
