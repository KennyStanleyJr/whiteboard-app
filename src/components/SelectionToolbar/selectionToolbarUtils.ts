import type { ElementBounds } from "@/utils/elementBounds";

export const TOOLBAR_OFFSET_PX = 8;

/** Preset font sizes in the dropdown (px); wider range, fewer close values. */
export const FONT_SIZE_PRESETS = [8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 96];

export const MIN_FONT_SIZE = 1;
export const MAX_FONT_SIZE = 999;

/** Throttle interval (ms) for applying color while dragging the picker. */
export const COLOR_APPLY_THROTTLE_MS = 80;

export function unionBounds(
  bounds: ElementBounds[]
): ElementBounds | null {
  if (bounds.length === 0) return null;
  let minX = bounds[0]!.x;
  let minY = bounds[0]!.y;
  let maxX = bounds[0]!.x + bounds[0]!.width;
  let maxY = bounds[0]!.y + bounds[0]!.height;
  for (let i = 1; i < bounds.length; i++) {
    const b = bounds[i]!;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Extract a hex color from inline style in HTML; returns #000000 if none found. */
export function parseHexFromContent(html: string): string {
  const hexMatch = html.match(/color:\s*#([0-9a-fA-F]{3,8})\b/);
  if (!hexMatch) return "#000000";
  const hex = hexMatch[1]!;
  if (hex.length === 6 || hex.length === 8) return "#" + hex;
  if (hex.length === 3)
    return "#" + hex[0]! + hex[0] + hex[1]! + hex[1] + hex[2]! + hex[2];
  return "#000000";
}
