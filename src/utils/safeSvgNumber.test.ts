import { describe, it, expect } from "vitest";
import { safeSvgNumber } from "./safeSvgNumber";

describe("safeSvgNumber", () => {
  it("returns value when it is finite", () => {
    expect(safeSvgNumber(0, 1)).toBe(0);
    expect(safeSvgNumber(42, 1)).toBe(42);
    expect(safeSvgNumber(-10.5, 1)).toBe(-10.5);
  });

  it("returns fallback when value is NaN", () => {
    expect(safeSvgNumber(Number.NaN, 0)).toBe(0);
    expect(safeSvgNumber(Number.NaN, 100)).toBe(100);
  });

  it("returns fallback when value is Infinity", () => {
    expect(safeSvgNumber(Number.POSITIVE_INFINITY, 0)).toBe(0);
    expect(safeSvgNumber(Number.NEGATIVE_INFINITY, 0)).toBe(0);
  });

  it("coerces numeric string to number when valid", () => {
    expect(safeSvgNumber(Number("42"), 0)).toBe(42);
  });
});
