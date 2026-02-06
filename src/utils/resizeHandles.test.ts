import { describe, it, expect } from "vitest";
import {
  resizeBoundsFromHandle,
  RESIZE_HANDLE_IDS,
  RESIZE_HANDLE_CURSORS,
} from "./resizeHandles";

const base = { x: 100, y: 50, width: 200, height: 100 };

describe("resizeBoundsFromHandle", () => {
  it("e handle: width increases by dx", () => {
    const result = resizeBoundsFromHandle(base, "e", 20, 0);
    expect(result).toEqual({ x: 100, y: 50, width: 220, height: 100 });
  });

  it("w handle: width decreases, x shifts", () => {
    const result = resizeBoundsFromHandle(base, "w", 20, 0);
    expect(result.x).toBe(120);
    expect(result.width).toBe(180);
    expect(result.y).toBe(50);
    expect(result.height).toBe(100);
  });

  it("s handle: height increases by dy", () => {
    const result = resizeBoundsFromHandle(base, "s", 0, 30);
    expect(result).toEqual({ x: 100, y: 50, width: 200, height: 130 });
  });

  it("n handle: height decreases, y shifts", () => {
    const result = resizeBoundsFromHandle(base, "n", 0, 20);
    expect(result.y).toBe(70);
    expect(result.height).toBe(80);
    expect(result.x).toBe(100);
    expect(result.width).toBe(200);
  });

  it("se handle: width and height increase", () => {
    const result = resizeBoundsFromHandle(base, "se", 10, 15);
    expect(result).toEqual({ x: 100, y: 50, width: 210, height: 115 });
  });

  it("nw handle: x and y shift, width and height decrease", () => {
    const result = resizeBoundsFromHandle(base, "nw", 10, 10);
    expect(result.x).toBe(110);
    expect(result.y).toBe(60);
    expect(result.width).toBe(190);
    expect(result.height).toBe(90);
  });

  it("enforces minimum size", () => {
    const small = { x: 0, y: 0, width: 50, height: 50 };
    const result = resizeBoundsFromHandle(small, "w", 100, 0);
    expect(result.width).toBeGreaterThanOrEqual(10);
    expect(result.height).toBeGreaterThanOrEqual(10);
  });

  it("shiftKey keeps aspect ratio on se handle", () => {
    const result = resizeBoundsFromHandle(
      base,
      "se",
      20,
      20,
      { shiftKey: true }
    );
    expect(result.width / result.height).toBeCloseTo(base.width / base.height);
  });

  it("ctrlKey keeps center position on e handle", () => {
    const centerX = base.x + base.width / 2;
    const result = resizeBoundsFromHandle(base, "e", 40, 0, { ctrlKey: true });
    expect(result.x + result.width / 2).toBeCloseTo(centerX);
  });

  it("shiftKey+ctrlKey: shiftKey takes precedence, ctrlKey center preservation is not applied", () => {
    const resultShiftOnly = resizeBoundsFromHandle(
      base,
      "e",
      40,
      0,
      { shiftKey: true }
    );
    const resultBoth = resizeBoundsFromHandle(
      base,
      "e",
      40,
      0,
      { shiftKey: true, ctrlKey: true }
    );
    expect(resultBoth).toEqual(resultShiftOnly);
  });
});

describe("RESIZE_HANDLE_IDS", () => {
  it("includes all eight handle directions", () => {
    expect(RESIZE_HANDLE_IDS).toHaveLength(8);
    expect(RESIZE_HANDLE_IDS).toContain("n");
    expect(RESIZE_HANDLE_IDS).toContain("s");
    expect(RESIZE_HANDLE_IDS).toContain("e");
    expect(RESIZE_HANDLE_IDS).toContain("w");
    expect(RESIZE_HANDLE_IDS).toContain("ne");
    expect(RESIZE_HANDLE_IDS).toContain("nw");
    expect(RESIZE_HANDLE_IDS).toContain("se");
    expect(RESIZE_HANDLE_IDS).toContain("sw");
  });
});

describe("RESIZE_HANDLE_CURSORS", () => {
  it("has cursor for each handle id", () => {
    for (const id of RESIZE_HANDLE_IDS) {
      expect(RESIZE_HANDLE_CURSORS[id]).toBeDefined();
      expect(typeof RESIZE_HANDLE_CURSORS[id]).toBe("string");
    }
  });
});
