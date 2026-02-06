import { describe, it, expect } from "vitest";
import { sanitizeHtml, plainTextToHtml, isHtmlContent } from "./sanitizeHtml";

describe("sanitizeHtml", () => {
  it("returns empty string for empty or whitespace input", () => {
    expect(sanitizeHtml("")).toBe("");
    expect(sanitizeHtml("   ")).toBe("");
  });

  it("allows safe inline tags", () => {
    expect(sanitizeHtml("<b>bold</b>")).toBe("<b>bold</b>");
    expect(sanitizeHtml("<i>italic</i>")).toBe("<i>italic</i>");
    expect(sanitizeHtml("<span>span</span>")).toBe("<span>span</span>");
    expect(sanitizeHtml("<p>para</p>")).toBe("<p>para</p>");
    expect(sanitizeHtml("<br>")).toContain("br");
  });

  it("strips disallowed tags but keeps their text", () => {
    const result = sanitizeHtml("<script>alert(1)</script>");
    expect(result).not.toContain("script");
    expect(result).toContain("alert(1)");
  });

  it("escapes dangerous characters in text", () => {
    const result = sanitizeHtml("<p>&lt;img onerror=1&gt;</p>");
    expect(result).not.toMatch(/<img/);
  });

  it("allows restricted style properties", () => {
    const html = '<span style="font-size: 14px; color: red;">x</span>';
    const result = sanitizeHtml(html);
    expect(result).toContain("font-size");
    expect(result).toContain("color");
  });
});

describe("plainTextToHtml", () => {
  it("escapes special characters and joins lines with br", () => {
    expect(plainTextToHtml("a\nb")).toBe("a<br>b");
    expect(plainTextToHtml("x & y")).toContain("&amp;");
    expect(plainTextToHtml("<tag>")).toContain("&lt;");
  });

  it("handles single line", () => {
    expect(plainTextToHtml("hello")).toBe("hello");
  });
});

describe("isHtmlContent", () => {
  it("returns true when content contains <", () => {
    expect(isHtmlContent("<p>hi</p>")).toBe(true);
    expect(isHtmlContent("a < b")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(isHtmlContent("plain text")).toBe(false);
    expect(isHtmlContent("")).toBe(false);
  });
});
