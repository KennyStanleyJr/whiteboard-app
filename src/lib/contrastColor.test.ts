import { describe, it, expect } from "vitest";
import {
  hexToLuminance,
  isCanvasBackgroundDark,
  getContrastingGridColor,
  getContrastingTextColor,
} from "./contrastColor";

describe("hexToLuminance", () => {
  it("returns 0 for pure black", () => {
    expect(hexToLuminance("#000000")).toBe(0);
  });

  it("returns 1 for pure white", () => {
    expect(hexToLuminance("#ffffff")).toBe(1);
  });

  it("accepts hex without leading #", () => {
    expect(hexToLuminance("000000")).toBe(0);
    expect(hexToLuminance("ffffff")).toBe(1);
  });

  it("returns value between 0 and 1 for gray", () => {
    const lum = hexToLuminance("#808080");
    expect(lum).toBeGreaterThan(0);
    expect(lum).toBeLessThan(1);
  });

  it("returns 0.5 for invalid or missing hex", () => {
    expect(hexToLuminance("")).toBe(0.5);
    expect(hexToLuminance("not-hex")).toBe(0.5);
    expect(hexToLuminance("#ab")).toBe(0.5);
  });
});

describe("isCanvasBackgroundDark", () => {
  it("returns true for black background", () => {
    expect(isCanvasBackgroundDark("#000000")).toBe(true);
  });

  it("returns true for dark gray", () => {
    expect(isCanvasBackgroundDark("#1a1a1a")).toBe(true);
  });

  it("returns false for white background", () => {
    expect(isCanvasBackgroundDark("#ffffff")).toBe(false);
  });

  it("returns false for non-hex background", () => {
    expect(isCanvasBackgroundDark("white")).toBe(false);
    expect(isCanvasBackgroundDark("rgb(0,0,0)")).toBe(false);
  });
});

describe("getContrastingGridColor", () => {
  it("returns light grid color for dark background", () => {
    const color = getContrastingGridColor("#000000");
    expect(color).toContain("255");
    expect(color).toContain("rgba");
  });

  it("returns dark grid color for light background", () => {
    const color = getContrastingGridColor("#ffffff");
    expect(color).toContain("0");
    expect(color).toContain("rgba");
  });

  it("returns dark grid color for non-hex background", () => {
    const color = getContrastingGridColor("transparent");
    expect(color).toBe("rgba(0, 0, 0, 0.2)");
  });
});

describe("getContrastingTextColor", () => {
  it("returns white for dark background", () => {
    expect(getContrastingTextColor("#000000")).toBe("#ffffff");
    expect(getContrastingTextColor("#1a1a1a")).toBe("#ffffff");
  });

  it("returns black for light background", () => {
    expect(getContrastingTextColor("#ffffff")).toBe("#000000");
    expect(getContrastingTextColor("#f0f0f0")).toBe("#000000");
  });

  it("returns black for non-hex background", () => {
    expect(getContrastingTextColor("transparent")).toBe("#000000");
    expect(getContrastingTextColor("rgb(0,0,0)")).toBe("#000000");
  });
});
