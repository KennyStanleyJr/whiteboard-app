import { useEffect, useRef } from "react";
import type { ImageElement } from "@/types/whiteboard";
import { safeSvgNumber } from "@/utils/safeSvgNumber";

export interface WhiteboardImageElementProps {
  element: ImageElement;
  onNaturalDimensions?: (
    elementId: string,
    naturalWidth: number,
    naturalHeight: number
  ) => void;
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

export function WhiteboardImageElement({
  element,
  onNaturalDimensions,
}: WhiteboardImageElementProps): JSX.Element {
  const x = safeSvgNumber(element.x, 0);
  const y = safeSvgNumber(element.y, 0);
  const w = safeSvgNumber(Math.max(1, element.width), 1);
  const h = safeSvgNumber(Math.max(1, element.height), 1);
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
