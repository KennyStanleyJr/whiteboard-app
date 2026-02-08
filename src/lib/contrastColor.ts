/**
 * Utilities to derive contrasting colors from a background color
 * so that grid and header remain visible on any canvas background.
 */

/**
 * Relative luminance of a hex color (0 = black, 1 = white).
 * https://www.w3.org/TR/WCAG20-TECHS/G17.html
 */
export function hexToLuminance(hex: string): number {
  const match = /^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec(hex);
  if (match == null || match[1] == null || match[2] == null || match[3] == null) {
    return 0.5;
  }
  const r = parseInt(match[1], 16) / 255;
  const g = parseInt(match[2], 16) / 255;
  const b = parseInt(match[3], 16) / 255;
  const rs = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gs = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bs = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** True when the background is dark (needs light foreground for contrast). */
export function isCanvasBackgroundDark(backgroundColor: string): boolean {
  if (!backgroundColor.startsWith("#")) return false;
  return hexToLuminance(backgroundColor) < 0.4;
}

/**
 * Grid color that contrasts with the given background (hex).
 * Dark background → light grid; light background → dark grid.
 */
export function getContrastingGridColor(backgroundColor: string): string {
  if (!backgroundColor.startsWith("#")) {
    return "rgba(0, 0, 0, 0.2)";
  }
  const luminance = hexToLuminance(backgroundColor);
  if (luminance < 0.4) {
    return "rgba(255, 255, 255, 0.25)";
  }
  return "rgba(0, 0, 0, 0.2)";
}

/**
 * Solid text color that contrasts with the given background (hex).
 * Dark background → #ffffff; light background → #000000.
 */
export function getContrastingTextColor(backgroundColor: string): string {
  if (!backgroundColor.startsWith("#")) {
    return "#000000";
  }
  return hexToLuminance(backgroundColor) < 0.4 ? "#ffffff" : "#000000";
}
