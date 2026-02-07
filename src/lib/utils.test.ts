import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("returns single class string", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("merges multiple class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters out falsy values", () => {
    expect(cn("foo", false, "bar", null, undefined)).toBe("foo bar");
  });

  it("merges Tailwind classes correctly (later overrides)", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("handles conditional classes", () => {
    const active = true;
    const inactive = false;
    expect(cn("base", active && "active")).toBe("base active");
    expect(cn("base", inactive && "active")).toBe("base");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });
});
