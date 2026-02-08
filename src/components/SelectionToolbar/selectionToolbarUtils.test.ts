import { describe, expect, it } from "vitest";
import type { WhiteboardElement } from "@/types/whiteboard";
import {
  FONT_SIZE_PRESETS,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  parseHexFromContent,
  reorderElementsBySelection,
  TOOLBAR_OFFSET_PX,
  unionBounds,
} from "./selectionToolbarUtils";

function el(id: string): WhiteboardElement {
  return { id, kind: "text", x: 0, y: 0, content: "", fontSize: 12 };
}

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
    it("is 5000", () => {
      expect(MAX_FONT_SIZE).toBe(5000);
    });
  });

  describe("reorderElementsBySelection", () => {
    it("puts selected first when putSelectedFirst is true", () => {
      const prev = [el("1"), el("2"), el("3")];
      expect(reorderElementsBySelection(prev, ["2", "3"], true)).toEqual([
        el("2"),
        el("3"),
        el("1"),
      ]);
    });

    it("puts selected last when putSelectedFirst is false", () => {
      const prev = [el("1"), el("2"), el("3")];
      expect(reorderElementsBySelection(prev, ["1", "2"], false)).toEqual([
        el("3"),
        el("1"),
        el("2"),
      ]);
    });

    it("preserves order when no selection", () => {
      const prev = [el("1"), el("2")];
      expect(reorderElementsBySelection(prev, [], true)).toEqual(prev);
      expect(reorderElementsBySelection(prev, [], false)).toEqual(prev);
    });

    it("preserves order when all selected (back = selected first)", () => {
      const prev = [el("1"), el("2")];
      expect(reorderElementsBySelection(prev, ["1", "2"], true)).toEqual(prev);
    });

    it("preserves order when all selected (front = selected last)", () => {
      const prev = [el("1"), el("2")];
      expect(reorderElementsBySelection(prev, ["1", "2"], false)).toEqual(prev);
    });

    it("keeps relative order of selected and unselected groups", () => {
      const prev = [el("a"), el("b"), el("c"), el("d")];
      const back = reorderElementsBySelection(prev, ["c"], true);
      expect(back.map((e) => e.id)).toEqual(["c", "a", "b", "d"]);
      const front = reorderElementsBySelection(prev, ["b"], false);
      expect(front.map((e) => e.id)).toEqual(["a", "c", "d", "b"]);
    });

    it("ignores selected ids not in prev", () => {
      const prev = [el("1"), el("2")];
      expect(reorderElementsBySelection(prev, ["2", "99"], true)).toEqual([
        el("2"),
        el("1"),
      ]);
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
