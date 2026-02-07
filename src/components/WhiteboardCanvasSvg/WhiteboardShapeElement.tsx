import { memo } from "react";
import type { ShapeElement } from "@/types/whiteboard";
import { safeSvgNumber } from "@/lib/safeSvgNumber";

const SHAPE_STROKE_WIDTH = 2;
const DEFAULT_SHAPE_COLOR = "#000000";

export interface WhiteboardShapeElementProps {
  element: ShapeElement;
}

function WhiteboardShapeElementInner({
  element,
}: WhiteboardShapeElementProps): JSX.Element {
  const color = element.color ?? DEFAULT_SHAPE_COLOR;
  const filled = element.filled !== false;
  const x = safeSvgNumber(element.x, 0);
  const y = safeSvgNumber(element.y, 0);
  const w = safeSvgNumber(Math.max(1, element.width), 1);
  const h = safeSvgNumber(Math.max(1, element.height), 1);

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

export const WhiteboardShapeElement = memo(WhiteboardShapeElementInner);
