import { GRID_OPACITY, GRID_SPACING } from "@/lib/gridPatternConstants";

const PATTERN_ID = "whiteboard-line-grid";

export interface LineGridPatternProps {
  /** Grid line color. */
  color: string;
}

export function LineGridPattern({ color }: LineGridPatternProps): JSX.Element {
  return (
    <pattern
      id={PATTERN_ID}
      x={0}
      y={0}
      width={GRID_SPACING}
      height={GRID_SPACING}
      patternUnits="userSpaceOnUse"
    >
      <line
        x1={GRID_SPACING / 2}
        y1={0}
        x2={GRID_SPACING / 2}
        y2={GRID_SPACING}
        stroke={color}
        strokeWidth={1}
        strokeOpacity={GRID_OPACITY}
      />
      <line
        x1={0}
        y1={GRID_SPACING / 2}
        x2={GRID_SPACING}
        y2={GRID_SPACING / 2}
        stroke={color}
        strokeWidth={1}
        strokeOpacity={GRID_OPACITY}
      />
    </pattern>
  );
}

export { PATTERN_ID as LINE_PATTERN_ID };
