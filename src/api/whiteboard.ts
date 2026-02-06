import type { WhiteboardElement } from "@/types/whiteboard";
import type { PanZoomState } from "@/hooks/panZoom/usePanZoom";
import { getCurrentBoardIdSync, getBoardsSync } from "./boards";

export interface WhiteboardState {
  elements: WhiteboardElement[];
  panZoom?: PanZoomState;
}

const LEGACY_STORAGE_KEY = "whiteboard-app-state";

/**
 * Get storage key for a specific board.
 */
export function getStorageKey(boardId: string): string {
  return `whiteboard-app-state-${boardId}`;
}

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
      const state = parsed as WhiteboardState;
      // Validate panZoom if present
      if (state.panZoom != null) {
        const pz = state.panZoom;
        if (
          typeof pz.panX !== "number" ||
          typeof pz.panY !== "number" ||
          typeof pz.zoom !== "number" ||
          !Number.isFinite(pz.panX) ||
          !Number.isFinite(pz.panY) ||
          !Number.isFinite(pz.zoom) ||
          pz.zoom <= 0
        ) {
          // Invalid panZoom, remove it
          return { elements: state.elements };
        }
      }
      return state;
    }
  } catch {
    /* invalid JSON: return safe default */
  }
  return { elements: [] };
}

/**
 * Synchronous read for initial paint. Use getWhiteboard() for async/API later.
 */
export function getWhiteboardSync(boardId?: string): WhiteboardState {
  const id = boardId ?? getCurrentBoardIdSync();
  const key = getStorageKey(id);
  const stored = localStorage.getItem(key);
  
  // Migration: check legacy storage if no board-specific storage exists
  // Migrate legacy data to the first/default board (regardless of its ID)
  if (stored == null) {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy != null) {
      const boards = getBoardsSync();
      const firstBoard = boards[0];
      // Only migrate if this is the first/default board
      if (firstBoard != null && id === firstBoard.id) {
        const state = parseStored(legacy);
        localStorage.setItem(key, JSON.stringify(state));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return state;
      }
    }
  }
  
  return parseStored(stored);
}

/**
 * Persistence layer for whiteboard data. Uses localStorage by default so we can
 * swap to IndexedDB or a remote API later without changing callers.
 */
export function getWhiteboard(boardId?: string): Promise<WhiteboardState> {
  const id = boardId ?? getCurrentBoardIdSync();
  return Promise.resolve(getWhiteboardSync(id));
}

/**
 * Persist whiteboard state. Replace this implementation to use a different backend.
 * Callers should handle the returned promise (e.g. .catch) for failure reporting.
 */
export function setWhiteboard(
  state: WhiteboardState,
  boardId?: string
): Promise<void> {
  const id = boardId ?? getCurrentBoardIdSync();
  const key = getStorageKey(id);
  localStorage.setItem(key, JSON.stringify(state));
  return Promise.resolve();
}

