import { describe, it, expect } from "vitest";
import { verticalAlignToJustifyContent } from "./verticalAlign";

describe("verticalAlignToJustifyContent", () => {
  it("returns flex-start for top", () => {
    expect(verticalAlignToJustifyContent("top")).toBe("flex-start");
  });

  it("returns center for middle", () => {
    expect(verticalAlignToJustifyContent("middle")).toBe("center");
  });

  it("returns flex-end for bottom", () => {
    expect(verticalAlignToJustifyContent("bottom")).toBe("flex-end");
  });

  it("returns flex-start when undefined (defaults to top)", () => {
    expect(verticalAlignToJustifyContent(undefined)).toBe("flex-start");
  });
});
