import { describe, it, expect } from "vitest";
import {
  sanitizeElementBounds,
  getElementBounds,
  elementsInRect,
  elementAtPoint,
  TEXT_EDIT_WIDTH,
  TEXT_EDIT_HEIGHT,
} from "./elementBounds";
import type { ImageElement, TextElement } from "../types/whiteboard";

describe("sanitizeElementBounds", () => {
  it("returns finite values and enforces minimum size", () => {
    expect(sanitizeElementBounds({ x: 10, y: 20, width: 50, height: 30 })).toEqual({
      x: 10,
      y: 20,
      width: 50,
      height: 30,
    });
  });

  it("replaces NaN with fallback and enforces minimum width/height", () => {
    const result = sanitizeElementBounds({
      x: Number.NaN,
      y: 0,
      width: Number.NaN,
      height: Number.NaN,
    });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.width).toBe(TEXT_EDIT_WIDTH);
    expect(result.height).toBe(TEXT_EDIT_HEIGHT);
  });

  it("enforces minimum size when width/height are finite but too small", () => {
    const result = sanitizeElementBounds({
      x: 0,
      y: 0,
      width: 0,
      height: -5,
    });
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});

describe("getElementBounds", () => {
  const textEl: TextElement = {
    id: "t1",
    kind: "text",
    x: 100,
    y: 50,
    content: "Hi",
    fontSize: 16,
  };

  it("uses element width/height when text has explicit positive size", () => {
    const el = { ...textEl, width: 200, height: 40 };
    expect(getElementBounds(el)).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 40,
    });
  });

  it("uses measuredBounds when no explicit size", () => {
    const measured = { t1: { x: 100, y: 50, width: 150, height: 22 } };
    expect(getElementBounds(textEl, measured)).toEqual({
      x: 100,
      y: 50,
      width: 150,
      height: 22,
    });
  });

  it("falls back to default text size when no explicit or measured size", () => {
    expect(getElementBounds(textEl)).toEqual({
      x: 100,
      y: 50,
      width: TEXT_EDIT_WIDTH,
      height: TEXT_EDIT_HEIGHT,
    });
  });

  it("sanitizes bounds with invalid numbers", () => {
    const el = { ...textEl, width: 100, height: 22 };
    const measured = { t1: { x: Number.NaN, y: 0, width: -5, height: 0 } };
    const result = getElementBounds(el, measured);
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.y)).toBe(true);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  it("uses width and height for image element", () => {
    const imageEl: ImageElement = {
      id: "i1",
      kind: "image",
      x: 0,
      y: 0,
      src: "data:image/png;base64,abc",
      width: 200,
      height: 150,
    };
    expect(getElementBounds(imageEl)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 150,
    });
  });
});

describe("elementsInRect", () => {
  const textEl1: TextElement = {
    id: "a",
    kind: "text",
    x: 10,
    y: 10,
    content: "A",
    width: 50,
    height: 20,
  };
  const textEl2: TextElement = {
    id: "b",
    kind: "text",
    x: 70,
    y: 10,
    content: "B",
    width: 50,
    height: 20,
  };
  const elements = [textEl1, textEl2];

  it("returns ids of elements overlapping the rect", () => {
    const rect = { x: 0, y: 0, width: 100, height: 50 };
    expect(elementsInRect(rect, elements)).toEqual(["a", "b"]);
  });

  it("returns only overlapping element", () => {
    const rect = { x: 0, y: 0, width: 30, height: 30 };
    expect(elementsInRect(rect, elements)).toEqual(["a"]);
  });

  it("returns empty when rect does not overlap any element", () => {
    const rect = { x: 200, y: 200, width: 10, height: 10 };
    expect(elementsInRect(rect, elements)).toEqual([]);
  });
});

describe("elementAtPoint", () => {
  const textEl1: TextElement = {
    id: "a",
    kind: "text",
    x: 0,
    y: 0,
    content: "A",
    width: 100,
    height: 50,
  };
  const textEl2: TextElement = {
    id: "b",
    kind: "text",
    x: 0,
    y: 0,
    content: "B",
    width: 100,
    height: 50,
  };
  const elements = [textEl1, textEl2];

  it("returns topmost element at point (last in array)", () => {
    expect(elementAtPoint(50, 25, elements)).toBe(textEl2);
  });

  it("returns null when point is outside all elements", () => {
    expect(elementAtPoint(200, 200, elements)).toBeNull();
  });

  it("returns single element when only one contains point", () => {
    const single = [textEl1];
    expect(elementAtPoint(50, 25, single)).toBe(textEl1);
  });
});
