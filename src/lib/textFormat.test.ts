import { describe, it, expect } from "vitest";
import {
  hasFormat,
  addFormatToContent,
  removeFormatFromContent,
  applyFormatToContent,
} from "./textFormat";

describe("textFormat", () => {
  describe("hasFormat", () => {
    it("returns true when content is wrapped in the tag", () => {
      expect(hasFormat("<b>x</b>", "b")).toBe(true);
      expect(hasFormat("<i>y</i>", "i")).toBe(true);
      expect(hasFormat("<u>z</u>", "u")).toBe(true);
    });

    it("returns false when content has no format", () => {
      expect(hasFormat("plain", "b")).toBe(false);
      expect(hasFormat("plain", "i")).toBe(false);
      expect(hasFormat("plain", "u")).toBe(false);
    });

    it("returns true for nested format (tag inside another)", () => {
      expect(hasFormat("<i><b>bi</b></i>", "b")).toBe(true);
      expect(hasFormat("<i><b>bi</b></i>", "i")).toBe(true);
    });

    it("ignores outer color span when checking", () => {
      expect(
        hasFormat('<span style="color: red">plain</span>', "b")
      ).toBe(false);
      expect(
        hasFormat('<span style="color: red"><b>bold</b></span>', "b")
      ).toBe(true);
    });
  });

  describe("addFormatToContent", () => {
    it("wraps plain content with the tag", () => {
      expect(addFormatToContent("Hi", "b")).toBe("<b>Hi</b>");
      expect(addFormatToContent("Hi", "i")).toBe("<i>Hi</i>");
      expect(addFormatToContent("Hi", "u")).toBe("<u>Hi</u>");
    });

    it("normalizes to single layer (no nested bold/strong)", () => {
      expect(addFormatToContent("<b>Hi</b>", "b")).toBe("<b>Hi</b>");
      expect(addFormatToContent("<b><strong>x</strong></b>", "b")).toBe("<b>x</b>");
      expect(addFormatToContent("<strong>y</strong>", "b")).toBe("<b>y</b>");
    });

    it("preserves outer color span", () => {
      const withColor = '<span style="color: #f00">x</span>';
      expect(addFormatToContent(withColor, "b")).toBe(
        '<span style="color: #f00"><b>x</b></span>'
      );
    });
  });

  describe("removeFormatFromContent", () => {
    it("removes single wrapping tag", () => {
      expect(removeFormatFromContent("<b>Hi</b>", "b")).toBe("Hi");
      expect(removeFormatFromContent("<i>Hi</i>", "i")).toBe("Hi");
      expect(removeFormatFromContent("<u>Hi</u>", "u")).toBe("Hi");
    });

    it("is no-op when format not present", () => {
      expect(removeFormatFromContent("plain", "b")).toBe("plain");
    });

    it("removes target tag from nested format (any order)", () => {
      expect(removeFormatFromContent("<b><i>bi</i></b>", "i")).toBe("<b>bi</b>");
      expect(removeFormatFromContent("<i><b>bi</b></i>", "b")).toBe("<i>bi</i>");
    });

    it("preserves outer color span", () => {
      const withColor = '<span style="color: red"><b>x</b></span>';
      expect(removeFormatFromContent(withColor, "b")).toBe(
        '<span style="color: red">x</span>'
      );
    });

    it("strips all bold layers (no extrabold; single toggle back to normal)", () => {
      expect(removeFormatFromContent("<b><b>Hi</b></b>", "b")).toBe("Hi");
      expect(removeFormatFromContent("<b><strong>Hi</strong></b>", "b")).toBe("Hi");
    });
  });

  describe("applyFormatToContent", () => {
    it("toggles on when format missing", () => {
      expect(applyFormatToContent("Hi", "b")).toBe("<b>Hi</b>");
    });

    it("toggles off when format present", () => {
      expect(applyFormatToContent("<b>Hi</b>", "b")).toBe("Hi");
    });

    it("works with nested and color span", () => {
      const content = '<span style="color: blue"><i>text</i></span>';
      expect(applyFormatToContent(content, "b")).toBe(
        '<span style="color: blue"><b><i>text</i></b></span>'
      );
      const withB = '<span style="color: blue"><b><i>text</i></b></span>';
      expect(applyFormatToContent(withB, "b")).toBe(
        '<span style="color: blue"><i>text</i></span>'
      );
    });
  });
});
