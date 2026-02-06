import { beforeEach, describe, expect, it } from "vitest";
import {
  getBoards,
  getBoardsSync,
  getCurrentBoardId,
  getCurrentBoardIdSync,
  setCurrentBoardId,
  addBoard,
  updateBoardName,
  deleteBoard,
  type Board,
} from "./boards";

const BOARDS_STORAGE_KEY = "whiteboard-app-boards";
const CURRENT_BOARD_ID_KEY = "whiteboard-app-current-board-id";
const WHITEBOARD_STATE_KEY_PREFIX = "whiteboard-app-state-";

describe("boards API", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getBoardsSync", () => {
    it("returns default board when storage is empty", () => {
      const boards = getBoardsSync();
      expect(boards).toHaveLength(1);
      const first = boards[0];
      expect(first).toBeDefined();
      expect(typeof first?.id).toBe("string");
      expect(first?.name).toBe("Whiteboard");
    });

    it("returns stored boards when valid", () => {
      const boards: Board[] = [
        { id: "board-1", name: "Board 1" },
        { id: "board-2", name: "Board 2" },
      ];
      localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify(boards));
      expect(getBoardsSync()).toEqual(boards);
    });

    it("returns default board when stored value is invalid JSON", () => {
      localStorage.setItem(BOARDS_STORAGE_KEY, "not json {");
      const boards = getBoardsSync();
      expect(boards).toHaveLength(1);
      const firstBoard = boards[0];
      expect(firstBoard).toBeDefined();
      expect(firstBoard?.name).toBe("Whiteboard");
    });
  });

  describe("getBoards", () => {
    it("returns boards asynchronously", async () => {
      const boards = await getBoards();
      expect(boards).toHaveLength(1);
      const firstBoard = boards[0];
      expect(firstBoard).toBeDefined();
      expect(firstBoard?.name).toBe("Whiteboard");
    });
  });

  describe("getCurrentBoardIdSync", () => {
    it("returns first board ID when no current board is set", () => {
      const boards = getBoardsSync();
      const firstBoard = boards[0];
      expect(firstBoard).toBeDefined();
      const currentId = getCurrentBoardIdSync();
      expect(currentId).toBe(firstBoard?.id);
    });

    it("returns stored current board ID when valid", () => {
      localStorage.setItem(CURRENT_BOARD_ID_KEY, "board-123");
      expect(getCurrentBoardIdSync()).toBe("board-123");
    });
  });

  describe("getCurrentBoardId", () => {
    it("returns current board ID asynchronously", async () => {
      localStorage.setItem(CURRENT_BOARD_ID_KEY, "board-456");
      const currentId = await getCurrentBoardId();
      expect(currentId).toBe("board-456");
    });
  });

  describe("setCurrentBoardId", () => {
    it("stores current board ID", async () => {
      await setCurrentBoardId("board-789");
      expect(localStorage.getItem(CURRENT_BOARD_ID_KEY)).toBe("board-789");
    });
  });

  describe("addBoard", () => {
    it("adds a new board to the list", async () => {
      const board = await addBoard("New Board");
      expect(board.name).toBe("New Board");
      expect(board.id).toBeTruthy();

      const boards = await getBoards();
      expect(boards).toHaveLength(2);
      expect(boards[1]).toEqual(board);
    });

    it("generates unique IDs for each board", async () => {
      const board1 = await addBoard("Board 1");
      const board2 = await addBoard("Board 2");
      expect(board1.id).not.toBe(board2.id);
    });
  });

  describe("updateBoardName", () => {
    it("updates the name of an existing board", async () => {
      const board = await addBoard("Original Name");
      await updateBoardName(board.id, "Updated Name");

      const boards = await getBoards();
      const updatedBoard = boards.find((b) => b.id === board.id);
      expect(updatedBoard?.name).toBe("Updated Name");
    });

    it("does not affect other boards", async () => {
      const board1 = await addBoard("Board 1");
      const board2 = await addBoard("Board 2");
      await updateBoardName(board1.id, "Updated Board 1");

      const boards = await getBoards();
      const unchangedBoard = boards.find((b) => b.id === board2.id);
      expect(unchangedBoard?.name).toBe("Board 2");
    });
  });

  describe("deleteBoard", () => {
    it("removes board from the list", async () => {
      const board1 = await addBoard("Board 1");
      const board2 = await addBoard("Board 2");
      await deleteBoard(board1.id);

      const boards = await getBoards();
      expect(boards).toHaveLength(2); // board2 + default board
      expect(boards.find((b) => b.id === board1.id)).toBeUndefined();
      expect(boards.find((b) => b.id === board2.id)).toBeDefined();
    });

    it("removes whiteboard state from localStorage", async () => {
      const board = await addBoard("Test Board");
      const storageKey = `${WHITEBOARD_STATE_KEY_PREFIX}${board.id}`;
      const testState = { elements: [{ id: "el-1", kind: "text", x: 0, y: 0, content: "Test" }] };
      localStorage.setItem(storageKey, JSON.stringify(testState));

      await deleteBoard(board.id);

      expect(localStorage.getItem(storageKey)).toBeNull();
    });

    it("does not delete the last board", async () => {
      const boards = await getBoards();
      const lastBoard = boards[0];
      expect(lastBoard).toBeDefined();
      if (lastBoard == null) return;
      await deleteBoard(lastBoard.id);

      const remainingBoards = await getBoards();
      expect(remainingBoards).toHaveLength(1);
      const remainingFirst = remainingBoards[0];
      expect(remainingFirst).toBeDefined();
      expect(remainingFirst?.id).toBe(lastBoard.id);
    });

    it("switches current board to first board if deleted board was current", async () => {
      const board1 = await addBoard("Board 1");
      await addBoard("Board 2"); // second board so we have multiple; current switches to first remaining
      await setCurrentBoardId(board1.id);
      await deleteBoard(board1.id);

      const currentId = await getCurrentBoardId();
      // Should switch to first board in filtered list (default board, not board2)
      const remainingBoards = await getBoards();
      const firstBoard = remainingBoards[0];
      expect(firstBoard).toBeDefined();
      expect(currentId).toBe(firstBoard?.id);
    });

    it("does not change current board if deleted board was not current", async () => {
      const board1 = await addBoard("Board 1");
      const board2 = await addBoard("Board 2");
      await setCurrentBoardId(board1.id);
      await deleteBoard(board2.id);

      const currentId = await getCurrentBoardId();
      expect(currentId).toBe(board1.id);
    });

    it("cleans up localStorage for deleted board even if state doesn't exist", async () => {
      const board = await addBoard("Test Board");
      const storageKey = `${WHITEBOARD_STATE_KEY_PREFIX}${board.id}`;
      
      // Ensure key doesn't exist
      localStorage.removeItem(storageKey);
      
      await deleteBoard(board.id);

      // Should not throw and should ensure key is removed
      expect(localStorage.getItem(storageKey)).toBeNull();
    });
  });
});
