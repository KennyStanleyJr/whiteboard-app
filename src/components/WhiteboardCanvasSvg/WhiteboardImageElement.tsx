import { memo, useEffect, useRef } from "react";
import { clampZoom } from "@/hooks/canvas/canvasCoords";
import type { ImageElement } from "@/types/whiteboard";
import { safeSvgNumber } from "@/lib/safeSvgNumber";

export interface WhiteboardImageElementProps {
  element: ImageElement;
  onNaturalDimensions?: (
    elementId: string,
    naturalWidth: number,
    naturalHeight: number
  ) => void;
  /** When set, render in viewBox space (for correct stacking with text layer). */
  viewBoxTransform?: { panX: number; panY: number; zoom: number };
}

function imageElementPropsEqual(
  a: WhiteboardImageElementProps,
  b: WhiteboardImageElementProps
): boolean {
  const elA = a.element;
  const elB = b.element;
  if (
    elA.id !== elB.id ||
    elA.x !== elB.x ||
    elA.y !== elB.y ||
    elA.width !== elB.width ||
    elA.height !== elB.height ||
    elA.src !== elB.src ||
    elA.imageFill !== elB.imageFill ||
    elA.imageCornerRadius !== elB.imageCornerRadius ||
    elA.naturalWidth !== elB.naturalWidth ||
    elA.naturalHeight !== elB.naturalHeight
  ) {
    return false;
  }
  if (a.onNaturalDimensions !== b.onNaturalDimensions) return false;
  const vtA = a.viewBoxTransform;
  const vtB = b.viewBoxTransform;
  if (vtA === vtB) return true;
  if (vtA == null || vtB == null) return false;
  return (
    vtA.panX === vtB.panX && vtA.panY === vtB.panY && vtA.zoom === vtB.zoom
  );
}

function clipRadius(
  cornerRadius: ImageElement["imageCornerRadius"],
  w: number,
  h: number
): number {
  const minDim = Math.min(w, h);
  switch (cornerRadius) {
    case "small":
      return minDim * 0.06;
    case "large":
      return minDim * 0.18;
    case "full":
      return minDim * 0.5;
    default:
      return 0;
  }
}

/** Compute the actual image rect when preserveAspectRatio is meet (contain). */
function meetRect(
  x: number,
  y: number,
  w: number,
  h: number,
  naturalW: number,
  naturalH: number
): { x: number; y: number; w: number; h: number } {
  if (naturalH <= 0 || naturalW <= 0 || h <= 0 || w <= 0) {
    return { x, y, w, h };
  }
  const imgAspect = naturalW / naturalH;
  const boxAspect = w / h;
  let rw: number;
  let rh: number;
  if (imgAspect > boxAspect) {
    rw = w;
    rh = w / imgAspect;
  } else {
    rh = h;
    rw = h * imgAspect;
  }
  return {
    x: x + (w - rw) / 2,
    y: y + (h - rh) / 2,
    w: rw,
    h: rh,
  };
}

function WhiteboardImageElementInner({
  element,
  onNaturalDimensions,
  viewBoxTransform,
}: WhiteboardImageElementProps): JSX.Element {
  const zoom = viewBoxTransform ? clampZoom(viewBoxTransform.zoom) : 1;
  const x = viewBoxTransform
    ? safeSvgNumber(viewBoxTransform.panX + zoom * element.x, 0)
    : safeSvgNumber(element.x, 0);
  const y = viewBoxTransform
    ? safeSvgNumber(viewBoxTransform.panY + zoom * element.y, 0)
    : safeSvgNumber(element.y, 0);
  const w = safeSvgNumber(
    Math.max(1, viewBoxTransform ? zoom * (element.width ?? 1) : (element.width ?? 1)),
    1
  );
  const h = safeSvgNumber(
    Math.max(1, viewBoxTransform ? zoom * (element.height ?? 1) : (element.height ?? 1)),
    1
  );
  const preserveAspectRatio = element.imageFill ? "none" : "xMidYMid meet";

  const loadedRef = useRef(false);
  useEffect(() => {
    if (
      (element.naturalWidth != null && element.naturalHeight != null) ||
      !onNaturalDimensions ||
      !element.src
    ) {
      return;
    }
    if (loadedRef.current) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      loadedRef.current = true;
      onNaturalDimensions(element.id, img.naturalWidth, img.naturalHeight);
    };
    img.src = element.src;
    return () => {
      cancelled = true;
    };
  }, [
    element.id,
    element.src,
    element.naturalWidth,
    element.naturalHeight,
    onNaturalDimensions,
  ]);

  const naturalW = element.naturalWidth ?? w;
  const naturalH = element.naturalHeight ?? h;
  const clipRect = element.imageFill
    ? { x, y, w, h }
    : meetRect(x, y, w, h, naturalW, naturalH);

  const radius = clipRadius(
    element.imageCornerRadius,
    clipRect.w,
    clipRect.h
  );

  const clipId = `img-clip-${element.id}`;

  if (radius <= 0) {
    return (
      <image
        href={element.src}
        x={x}
        y={y}
        width={w}
        height={h}
        preserveAspectRatio={preserveAspectRatio}
      />
    );
  }

  return (
    <g>
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <rect
            x={clipRect.x}
            y={clipRect.y}
            width={clipRect.w}
            height={clipRect.h}
            rx={radius}
            ry={radius}
          />
        </clipPath>
      </defs>
      <image
        href={element.src}
        x={x}
        y={y}
        width={w}
        height={h}
        preserveAspectRatio={preserveAspectRatio}
        clipPath={`url(#${clipId})`}
      />
    </g>
  );
}

export const WhiteboardImageElement = memo(
  WhiteboardImageElementInner,
  imageElementPropsEqual
);
