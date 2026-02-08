/**
 * Whether the browser needs the foreignObject transform workaround.
 * Safari and WebKit (including iOS Chrome/Firefox) have bug 23113:
 * HTML inside SVG foreignObject doesn't inherit parent SVG transforms when
 * the content uses RenderLayers (position, transform, overflow).
 * See: https://bugs.webkit.org/show_bug.cgi?id=23113
 */
export function needsForeignObjectTransformWorkaround(): boolean {
  return false;
}

/**
 * Use HTML overlay for text instead of SVG foreignObject on Safari/iOS.
 * foreignObject breaks after pan/zoom on iOS; overlay avoids it entirely.
 */
export function shouldUseSafariTextOverlay(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari =
    ua.includes("Safari") &&
    !ua.includes("Chrome") &&
    !ua.includes("Chromium") &&
    !ua.includes("CriOS") &&
    !ua.includes("FxiOS");
  return isIOS || isSafari;
}
