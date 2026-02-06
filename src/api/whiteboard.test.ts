import { beforeEach, describe, expect, it } from "vitest";
import { getCurrentBoardIdSync } from "./boards";
import {
  getStorageKey,
  getWhiteboard,
  getWhiteboardSync,
  setWhiteboard,
  type WhiteboardState,
} from "./whiteboard";

const LEGACY_STORAGE_KEY = "whiteboard-app-state";

function currentBoardStorageKey(): string {
  return getStorageKey(getCurrentBoardIdSync());
}

describe("whiteboard API", () => {
  beforeEach(() => {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(currentBoardStorageKey());
  });

  describe("getWhiteboardSync", () => {
    it("returns empty elements when storage is empty", () => {
      expect(getWhiteboardSync()).toEqual({ elements: [] });
    });

    it("returns empty elements when key is missing", () => {
      localStorage.setItem("other-key", "{}");
      expect(getWhiteboardSync()).toEqual({ elements: [] });
    });

    it("returns stored state when valid JSON with elements array", () => {
      const state: WhiteboardState = {
        elements: [
          { id: "a", kind: "text", x: 0, y: 0, content: "Hi" },
        ],
      };
      localStorage.setItem(currentBoardStorageKey(), JSON.stringify(state));
      expect(getWhiteboardSync()).toEqual(state);
    });

    it("returns empty elements when stored value is null string", () => {
      localStorage.setItem(currentBoardStorageKey(), "null");
      expect(getWhiteboardSync()).toEqual({ elements: [] });
    });

    it("returns empty elements when stored value is invalid JSON", () => {
      localStorage.setItem(currentBoardStorageKey(), "not json {");
      expect(getWhiteboardSync()).toEqual({ elements: [] });
    });

    it("returns empty elements when parsed object has no elements array", () => {
      localStorage.setItem(currentBoardStorageKey(), JSON.stringify({ foo: 1 }));
      expect(getWhiteboardSync()).toEqual({ elements: [] });
    });

    it("returns empty elements when parsed value is empty array", () => {
      localStorage.setItem(currentBoardStorageKey(), "[]");
      expect(getWhiteboardSync()).toEqual({ elements: [] });
    });
  });

  describe("getWhiteboard", () => {
    it("resolves to same result as getWhiteboardSync when storage empty", async () => {
      const result = await getWhiteboard();
      expect(result).toEqual({ elements: [] });
    });

    it("resolves to stored state when valid", async () => {
      const state: WhiteboardState = {
        elements: [
          { id: "b", kind: "text", x: 10, y: 20, content: "Hello" },
        ],
      };
      localStorage.setItem(currentBoardStorageKey(), JSON.stringify(state));
      const result = await getWhiteboard();
      expect(result).toEqual(state);
    });

    it("round-trips ImageElement with imageCornerRadius", async () => {
      const state: WhiteboardState = {
        elements: [
          {
            id: "img1",
            kind: "image",
            x: 0,
            y: 0,
            src: "data:image/png;base64,x",
            width: 100,
            height: 80,
            imageCornerRadius: "large",
          },
        ],
      };
      await setWhiteboard(state);
      expect(getWhiteboardSync()).toEqual(state);
    });
  });

  describe("setWhiteboard", () => {
    it("persists state so getWhiteboardSync reads it back", () => {
      const state: WhiteboardState = {
        elements: [
          { id: "c", kind: "text", x: 5, y: 5, content: "Saved" },
        ],
      };
      return setWhiteboard(state).then(() => {
        expect(getWhiteboardSync()).toEqual(state);
      });
    });

    it("returns a promise that resolves", async () => {
      const state: WhiteboardState = { elements: [] };
      await expect(setWhiteboard(state)).resolves.toBeUndefined();
    });
  });
});
