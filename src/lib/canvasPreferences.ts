/**
 * App-wide canvas preferences (theme only).
 * Background and grid style are stored per whiteboard in whiteboard state.
 */

const THEME_STORAGE_KEY = "whiteboard-app-theme";

export type GridStyle = "empty" | "dotted" | "lined" | "grid-lined";
export type Theme = "light" | "dark";

export interface CanvasPreferences {
  theme: Theme;
}

export const DEFAULT_CANVAS_PREFERENCES: CanvasPreferences = {
  theme: "light",
};

function getStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function loadCanvasPreferences(): CanvasPreferences {
  const theme = getStored(THEME_STORAGE_KEY);
  const isValidTheme = (t: string): t is Theme =>
    t === "light" || t === "dark";
  return {
    theme: theme != null && isValidTheme(theme) ? theme : DEFAULT_CANVAS_PREFERENCES.theme,
  };
}

export function saveCanvasPreference<K extends keyof CanvasPreferences>(
  key: K,
  value: CanvasPreferences[K]
): void {
  if (key === "theme") {
    setStored(THEME_STORAGE_KEY, String(value));
  }
}

/**
 * Theme is applied via the app root div (menus, toolbars, management only).
 * Do not add .dark to documentElement so the canvas area stays light.
 */
export function applyTheme(): void {
  /* No-op: App applies .dark to its root div when theme is dark */
}
