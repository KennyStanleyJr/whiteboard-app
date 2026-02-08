/**
 * Whether the browser needs the foreignObject transform workaround.
 * Safari and WebKit (including iOS Chrome/Firefox) have bug 23113:
 * HTML inside SVG foreignObject doesn't inherit parent SVG transforms when
 * the content uses RenderLayers (position, transform, overflow).
 * See: https://bugs.webkit.org/show_bug.cgi?id=23113
 *
 * Disabled: the compensating CSS transform uses viewBox units as px, which
 * maps incorrectly on mobile viewports and can push text off-screen or make
 * it invisible. Until we use getScreenCTM() for accurate pixel placement,
 * keep this off so text remains visible (panning will misalign text on Safari).
 */
export function needsForeignObjectTransformWorkaround(): boolean {
  return false;
}
