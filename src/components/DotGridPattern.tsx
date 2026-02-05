const GRID_SPACING = 24;
const GRID_DOT_RADIUS = 1;
const PATTERN_ID = "whiteboard-dot-grid";

export function DotGridPattern(): JSX.Element {
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
        fill="currentColor"
        opacity={0.2}
      />
    </pattern>
  );
}

export { PATTERN_ID };
