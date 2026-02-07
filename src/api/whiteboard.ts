import type { WhiteboardElement } from "@/types/whiteboard";
import type { PanZoomState } from "@/hooks/panZoom/usePanZoom";
import { APP_VERSION } from "@/version";
import { getCurrentBoardIdSync, getBoardsSync } from "./boards";
import type { GridStyle } from "@/lib/canvasPreferences";

export interface WhiteboardState {
  elements: WhiteboardElement[];
  panZoom?: PanZoomState;
  /** Canvas background fill color (hex). Stored per board. */
  backgroundColor?: string;
  /** Grid style for this board. */
  gridStyle?: GridStyle;
}

const LEGACY_STORAGE_KEY = "whiteboard-app-state";

type StoredState = WhiteboardState & { _version?: string };

/** True if a is less than b (semver). */
function semverLt(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na < nb;
  }
  return false;
}

/**
 * Run migrations from stored version to APP_VERSION (see src/version.ts).
 * Add new blocks when introducing breaking state changes and bump APP_VERSION.
 */
function runMigrations(state: StoredState): void {
  const stored = state._version ?? "0.0.0";
  if (semverLt(stored, "0.1.0")) {
    /* Grid style renames: notebook → lined, lined → grid-lined */
    const raw = state.gridStyle as string | undefined;
    if (raw === "notebook") state.gridStyle = "lined";
    else if (raw === "lined") state.gridStyle = "grid-lined";
  }
  state._version = APP_VERSION;
}

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
      const state = parsed as StoredState;
      runMigrations(state);
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
          state.panZoom = undefined;
        }
      }
      const validGridStyle = (s: string): s is GridStyle =>
        s === "empty" ||
        s === "dotted" ||
        s === "lined" ||
        s === "grid-lined";
      if (
        state.backgroundColor != null &&
        !/^#[0-9A-Fa-f]{6}$/.test(state.backgroundColor)
      ) {
        state.backgroundColor = undefined;
      }
      if (
        state.gridStyle != null &&
        !validGridStyle(state.gridStyle)
      ) {
        state.gridStyle = undefined;
      }
      delete state._version;
      return state as WhiteboardState;
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
        const toSave: StoredState = { ...state, _version: APP_VERSION };
        localStorage.setItem(key, JSON.stringify(toSave));
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
  const toSave: StoredState = { ...state, _version: APP_VERSION };
  localStorage.setItem(key, JSON.stringify(toSave));
  return Promise.resolve();
}

