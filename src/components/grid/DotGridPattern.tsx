import { GRID_OPACITY, GRID_SPACING } from "@/lib/gridPatternConstants";

const GRID_DOT_RADIUS = 1;
const PATTERN_ID = "whiteboard-dot-grid";

export interface DotGridPatternProps {
  /** Grid dot color. Defaults to currentColor with opacity. */
  color?: string;
}

export function DotGridPattern({ color }: DotGridPatternProps = {}): JSX.Element {
  const fill = color ?? "currentColor";
  return (
    <pattern
      id={PATTERN_ID}
      x={0}
      y={0}
      width={GRID_SPACING}
      height={GRID_SPACING}
      patternUnits="userSpaceOnUse"
    >
      <circle
        cx={GRID_SPACING / 2}
        cy={GRID_SPACING / 2}
        r={GRID_DOT_RADIUS}
        fill={fill}
        opacity={color != null ? GRID_OPACITY : 0.2}
      />
    </pattern>
  );
}

export { PATTERN_ID };
