/**
 * Return a number safe for SVG attributes (finite; no NaN/Infinity).
 * Use at render boundaries so the DOM never receives invalid values.
 */

export function safeSvgNumber(value: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
