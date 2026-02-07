import { GRID_OPACITY, GRID_SPACING } from "@/lib/gridPatternConstants";

const PATTERN_ID = "whiteboard-notebook-grid";

export interface NotebookGridPatternProps {
  /** Line color. */
  color: string;
}

export function NotebookGridPattern({
  color,
}: NotebookGridPatternProps): JSX.Element {
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

export { PATTERN_ID as NOTEBOOK_PATTERN_ID };
