import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadCanvasPreferences,
  saveCanvasPreference,
  DEFAULT_CANVAS_PREFERENCES,
  applyTheme,
  type Theme,
} from "./canvasPreferences";

const THEME_KEY = "whiteboard-app-theme";

describe("canvasPreferences", () => {
  const store: Record<string, string> = {};
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    vi.stubGlobal("localStorage", mockStorage);
  });

  afterEach(() => {
    vi.stubGlobal("localStorage", originalLocalStorage);
  });

  describe("DEFAULT_CANVAS_PREFERENCES", () => {
    it("has theme set to light", () => {
      expect(DEFAULT_CANVAS_PREFERENCES.theme).toBe("light");
    });
  });

  describe("loadCanvasPreferences", () => {
    it("returns default preferences when localStorage has no theme", () => {
      expect(loadCanvasPreferences()).toEqual({ theme: "light" });
    });

    it("returns light theme when stored value is light", () => {
      store[THEME_KEY] = "light";
      expect(loadCanvasPreferences()).toEqual({ theme: "light" });
    });

    it("returns dark theme when stored value is dark", () => {
      store[THEME_KEY] = "dark";
      expect(loadCanvasPreferences()).toEqual({ theme: "dark" });
    });

    it("returns default when stored value is invalid", () => {
      store[THEME_KEY] = "invalid";
      expect(loadCanvasPreferences()).toEqual({ theme: "light" });
    });

    it("returns default when localStorage throws", () => {
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("storage unavailable");
        },
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      });
      expect(loadCanvasPreferences()).toEqual({ theme: "light" });
    });
  });

  describe("saveCanvasPreference", () => {
    it("saves theme to localStorage", () => {
      saveCanvasPreference("theme", "dark" as Theme);
      expect(store[THEME_KEY]).toBe("dark");
    });

    it("saves light theme", () => {
      saveCanvasPreference("theme", "light" as Theme);
      expect(store[THEME_KEY]).toBe("light");
    });
  });

  describe("applyTheme", () => {
    it("does not throw", () => {
      expect(() => applyTheme()).not.toThrow();
    });
  });
});
