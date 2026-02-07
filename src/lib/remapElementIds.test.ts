import { describe, it, expect } from "vitest";
import { remapElementIdsForAppend } from "./remapElementIds";
import type { TextElement, WhiteboardElement } from "@/types/whiteboard";

function textEl(id: string, content: string): TextElement {
  return { id, kind: "text", x: 0, y: 0, content };
}

describe("remapElementIdsForAppend", () => {
  it("returns new elements with IDs not in existingIds", () => {
    const existingIds = new Set(["el-1", "el-2"]);
    const elements: WhiteboardElement[] = [
      textEl("el-1", "same id as existing"),
      textEl("el-3", "new id"),
    ];
    const result = remapElementIdsForAppend(existingIds, elements);
    expect(result).toHaveLength(2);
    const resultIds = result.map((e) => e.id);
    expect(resultIds[0]).not.toBe("el-1");
    expect(resultIds[1]).not.toBe("el-3");
    expect(existingIds.has(resultIds[0] ?? "")).toBe(false);
    expect(existingIds.has(resultIds[1] ?? "")).toBe(false);
    expect(resultIds[0]).not.toBe(resultIds[1]);
  });

  it("preserves element order and other properties", () => {
    const existingIds = new Set<string>();
    const elements: WhiteboardElement[] = [
      textEl("a", "first"),
      textEl("b", "second"),
    ];
    const result = remapElementIdsForAppend(existingIds, elements);
    expect(result).toHaveLength(2);
    const first = result[0];
    const second = result[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first!.kind).toBe("text");
    expect((first as TextElement).content).toBe("first");
    expect(second!.kind).toBe("text");
    expect((second as TextElement).content).toBe("second");
  });

  it("gives unique IDs when incoming elements have duplicate IDs", () => {
    const existingIds = new Set<string>();
    const elements: WhiteboardElement[] = [
      textEl("dup", "one"),
      textEl("dup", "two"),
      textEl("dup", "three"),
    ];
    const result = remapElementIdsForAppend(existingIds, elements);
    expect(result).toHaveLength(3);
    const ids = result.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  it("returns empty array when elements is empty", () => {
    const existingIds = new Set(["el-1"]);
    const result = remapElementIdsForAppend(existingIds, []);
    expect(result).toEqual([]);
  });

  it("does not mutate the existingIds set", () => {
    const existingIds = new Set(["id-1", "id-2"]);
    const elements: WhiteboardElement[] = [textEl("new", "x")];
    remapElementIdsForAppend(existingIds, elements);
    expect(existingIds.size).toBe(2);
    expect(existingIds.has("id-1")).toBe(true);
    expect(existingIds.has("id-2")).toBe(true);
  });
});
