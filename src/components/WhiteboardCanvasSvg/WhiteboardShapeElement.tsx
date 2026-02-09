import { memo } from "react";
import { clampZoom } from "@/hooks/canvas/canvasCoords";
import type { ShapeElement } from "@/types/whiteboard";
import { safeSvgNumber } from "@/lib/safeSvgNumber";

const SHAPE_STROKE_WIDTH = 2;
const DEFAULT_SHAPE_COLOR = "#000000";

export interface WhiteboardShapeElementProps {
  element: ShapeElement;
  /** When set, render in viewBox space (for correct stacking with text layer). */
  viewBoxTransform?: { panX: number; panY: number; zoom: number };
}

function shapeElementPropsEqual(
  a: WhiteboardShapeElementProps,
  b: WhiteboardShapeElementProps
): boolean {
  const elA = a.element;
  const elB = b.element;
  if (
    elA.id !== elB.id ||
    elA.x !== elB.x ||
    elA.y !== elB.y ||
    elA.shapeType !== elB.shapeType ||
    elA.width !== elB.width ||
    elA.height !== elB.height ||
    elA.color !== elB.color ||
    elA.filled !== elB.filled
  ) {
    return false;
  }
  const vtA = a.viewBoxTransform;
  const vtB = b.viewBoxTransform;
  if (vtA === vtB) return true;
  if (vtA == null || vtB == null) return false;
  return (
    vtA.panX === vtB.panX && vtA.panY === vtB.panY && vtA.zoom === vtB.zoom
  );
}

function WhiteboardShapeElementInner({
  element,
  viewBoxTransform,
}: WhiteboardShapeElementProps): JSX.Element {
  const color = element.color ?? DEFAULT_SHAPE_COLOR;
  const filled = element.filled !== false;
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

  const fill = filled ? color : "none";
  const stroke = filled ? "none" : color;
  const strokeWidth = filled ? 0 : SHAPE_STROKE_WIDTH;

  if (element.shapeType === "ellipse") {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    return (
      <ellipse
        cx={safeSvgNumber(cx, 0)}
        cy={safeSvgNumber(cy, 0)}
        rx={safeSvgNumber(rx, 1)}
        ry={safeSvgNumber(ry, 1)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      vectorEffect="non-scaling-stroke"
    />
  );
}

export const WhiteboardShapeElement = memo(
  WhiteboardShapeElementInner,
  shapeElementPropsEqual
);
