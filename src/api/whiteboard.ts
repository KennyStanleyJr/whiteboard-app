import type { WhiteboardElement } from "@/types/whiteboard";

export interface WhiteboardState {
  elements: WhiteboardElement[];
}

const STORAGE_KEY = "whiteboard-app-state";

/**
 * Parse stored JSON into WhiteboardState. Validates parameter and shape;
 * returns default state on null, invalid JSON, or missing elements array.
 */
function parseStored(raw: string | null): WhiteboardState {
  if (raw == null) return { elements: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed != null &&
      typeof parsed === "object" &&
      Array.isArray((parsed as WhiteboardState).elements)
    ) {
      return parsed as WhiteboardState;
    }
  } catch {
    /* invalid JSON: return safe default */
  }
  return { elements: [] };
}

/**
 * Synchronous read for initial paint. Use getWhiteboard() for async/API later.
 */
export function getWhiteboardSync(): WhiteboardState {
  return parseStored(localStorage.getItem(STORAGE_KEY));
}

/**
 * Persistence layer for whiteboard data. Uses localStorage by default so we can
 * swap to IndexedDB or a remote API later without changing callers.
 */
export function getWhiteboard(): Promise<WhiteboardState> {
  return Promise.resolve(parseStored(localStorage.getItem(STORAGE_KEY)));
}

/**
 * Persist whiteboard state. Replace this implementation to use a different backend.
 * Callers should handle the returned promise (e.g. .catch) for failure reporting.
 */
export function setWhiteboard(state: WhiteboardState): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return Promise.resolve();
}
