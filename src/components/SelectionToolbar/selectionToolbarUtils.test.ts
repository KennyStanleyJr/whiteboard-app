import { describe, expect, it } from "vitest";
import {
  FONT_SIZE_PRESETS,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  parseHexFromContent,
  TOOLBAR_OFFSET_PX,
  unionBounds,
} from "./selectionToolbarUtils";

describe("selectionToolbarUtils", () => {
  describe("TOOLBAR_OFFSET_PX", () => {
    it("is a positive number", () => {
      expect(TOOLBAR_OFFSET_PX).toBe(8);
    });
  });

  describe("FONT_SIZE_PRESETS", () => {
    it("is a non-empty array of numbers", () => {
      expect(Array.isArray(FONT_SIZE_PRESETS)).toBe(true);
      expect(FONT_SIZE_PRESETS.length).toBeGreaterThan(0);
      expect(FONT_SIZE_PRESETS.every((n) => typeof n === "number")).toBe(true);
    });

    it("includes 24", () => {
      expect(FONT_SIZE_PRESETS).toContain(24);
    });
  });

  describe("MIN_FONT_SIZE", () => {
    it("is 1", () => {
      expect(MIN_FONT_SIZE).toBe(1);
    });
  });

  describe("MAX_FONT_SIZE", () => {
    it("is 999", () => {
      expect(MAX_FONT_SIZE).toBe(999);
    });
  });

  describe("unionBounds", () => {
    it("returns null for empty array", () => {
      expect(unionBounds([])).toBeNull();
    });

    it("returns single rect for one bound", () => {
      const b = { x: 10, y: 20, width: 100, height: 50 };
      expect(unionBounds([b])).toEqual(b);
    });

    it("returns union of two non-overlapping rects", () => {
      const a = { x: 0, y: 0, width: 10, height: 10 };
      const b = { x: 20, y: 30, width: 10, height: 10 };
      expect(unionBounds([a, b])).toEqual({
        x: 0,
        y: 0,
        width: 30,
        height: 40,
      });
    });

    it("returns union of overlapping rects", () => {
      const a = { x: 0, y: 0, width: 20, height: 20 };
      const b = { x: 10, y: 10, width: 20, height: 20 };
      expect(unionBounds([a, b])).toEqual({
        x: 0,
        y: 0,
        width: 30,
        height: 30,
      });
    });
  });

  describe("parseHexFromContent", () => {
    it("returns #000000 when no color in content", () => {
      expect(parseHexFromContent("plain text")).toBe("#000000");
      expect(parseHexFromContent("<b>bold</b>")).toBe("#000000");
    });

    it("extracts 6-digit hex from inline style", () => {
      expect(
        parseHexFromContent('<span style="color: #ff0000">red</span>')
      ).toBe("#ff0000");
      expect(
        parseHexFromContent('<span style="color:#00FF00">green</span>')
      ).toBe("#00FF00");
    });

    it("extracts 8-digit hex (with alpha)", () => {
      expect(
        parseHexFromContent('<span style="color: #00000080">semi</span>')
      ).toBe("#00000080");
    });

    it("expands 3-digit shorthand to 6-digit", () => {
      expect(
        parseHexFromContent('<span style="color: #f00">red</span>')
      ).toBe("#ff0000");
    });

    it("returns #000000 for invalid or unsupported hex", () => {
      expect(parseHexFromContent('style="color: #gggggg"')).toBe("#000000");
      expect(parseHexFromContent('style="color: #12"')).toBe("#000000");
    });
  });
});
