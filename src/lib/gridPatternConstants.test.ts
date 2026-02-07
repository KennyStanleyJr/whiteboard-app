import { describe, it, expect } from "vitest";
import { GRID_OPACITY, GRID_SPACING } from "./gridPatternConstants";

describe("gridPatternConstants", () => {
  it("exports GRID_SPACING as a positive number", () => {
    expect(GRID_SPACING).toBeGreaterThan(0);
    expect(Number.isFinite(GRID_SPACING)).toBe(true);
  });

  it("exports GRID_OPACITY in 0–1 range", () => {
    expect(GRID_OPACITY).toBeGreaterThanOrEqual(0);
    expect(GRID_OPACITY).toBeLessThanOrEqual(1);
    expect(Number.isFinite(GRID_OPACITY)).toBe(true);
  });

  it("uses expected values for grid rendering", () => {
    expect(GRID_SPACING).toBe(32);
    expect(GRID_OPACITY).toBe(0.65);
  });
});
