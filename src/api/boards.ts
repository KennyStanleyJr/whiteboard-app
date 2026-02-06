export interface Board {
  id: string;
  name: string;
}

const BOARDS_STORAGE_KEY = "whiteboard-app-boards";
const CURRENT_BOARD_ID_KEY = "whiteboard-app-current-board-id";

/** Key prefix for per-board whiteboard state (must match whiteboard.ts). */
const WHITEBOARD_STATE_KEY_PREFIX = "whiteboard-app-state-";

/**
 * Generate a random board ID.
 */
function generateBoardId(): string {
  return Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);
}

/**
 * Parse stored boards JSON. Returns default board list if invalid.
 */
function parseBoards(raw: string | null): Board[] {
  if (raw == null) {
    // Migration: check if old single board exists
    const oldState = localStorage.getItem("whiteboard-app-state");
    if (oldState != null) {
      // Migrate old single board to new system with random ID
      return [{ id: generateBoardId(), name: "Whiteboard" }];
    }
    return [{ id: generateBoardId(), name: "Whiteboard" }];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed != null &&
      typeof parsed === "object" &&
      Array.isArray(parsed)
    ) {
      const boards = parsed as Board[];
      // Validate board structure
      if (
        boards.every(
          (b) =>
            b != null &&
            typeof b === "object" &&
            typeof b.id === "string" &&
            typeof b.name === "string"
        )
      ) {
        return boards;
      }
    }
  } catch {
    /* invalid JSON: return default */
  }
  return [{ id: generateBoardId(), name: "Whiteboard" }];
}

/**
 * Get all boards synchronously.
 */
export function getBoardsSync(): Board[] {
  const raw = localStorage.getItem(BOARDS_STORAGE_KEY);
  const boards = parseBoards(raw);
  // If no boards were stored, save the default board
  if (raw == null && boards.length > 0) {
    localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify(boards));
  }
  return boards;
}

/**
 * Get all boards.
 */
export function getBoards(): Promise<Board[]> {
  return Promise.resolve(getBoardsSync());
}

/**
 * Save boards list.
 */
export function setBoards(boards: Board[]): Promise<void> {
  localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify(boards));
  return Promise.resolve();
}

/**
 * Get current board ID synchronously.
 */
export function getCurrentBoardIdSync(): string {
  const stored = localStorage.getItem(CURRENT_BOARD_ID_KEY);
  if (stored != null && stored.length > 0) {
    return stored;
  }
  // Default to first board
  const boards = getBoardsSync();
  const firstBoard = boards[0];
  return firstBoard != null ? firstBoard.id : generateBoardId();
}

/**
 * Get current board ID.
 */
export function getCurrentBoardId(): Promise<string> {
  return Promise.resolve(getCurrentBoardIdSync());
}

/**
 * Set current board ID.
 */
export function setCurrentBoardId(boardId: string): Promise<void> {
  localStorage.setItem(CURRENT_BOARD_ID_KEY, boardId);
  return Promise.resolve();
}

/**
 * Create a new board with generated ID.
 */
export function createBoard(name: string): Board {
  const id = generateBoardId();
  return { id, name };
}

/**
 * Add a new board.
 */
export async function addBoard(name: string): Promise<Board> {
  const board = createBoard(name);
  const boards = await getBoards();
  await setBoards([...boards, board]);
  return board;
}

/**
 * Update board name.
 */
export async function updateBoardName(
  boardId: string,
  name: string
): Promise<void> {
  const boards = await getBoards();
  const updated = boards.map((b) => (b.id === boardId ? { ...b, name } : b));
  await setBoards(updated);
}

/**
 * Delete a board.
 */
export async function deleteBoard(boardId: string): Promise<void> {
  const boards = await getBoards();
  const filtered = boards.filter((b) => b.id !== boardId);
  if (filtered.length === 0) {
    // Don't allow deleting the last board
    return;
  }
  await setBoards(filtered);
  // Delete whiteboard state from localStorage (key must match whiteboard.ts)
  const storageKey = `${WHITEBOARD_STATE_KEY_PREFIX}${boardId}`;
  localStorage.removeItem(storageKey);
  // If deleted board was current, switch to first board
  const currentId = await getCurrentBoardId();
  if (currentId === boardId && filtered.length > 0) {
    const firstBoard = filtered[0];
    if (firstBoard != null) {
      await setCurrentBoardId(firstBoard.id);
    }
  }
}
