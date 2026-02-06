import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useWhiteboardQuery,
  getWhiteboardQueryKey,
} from "./useWhiteboard";
import * as whiteboardApi from "@/api/whiteboard";
import { getCurrentBoardIdSync } from "@/api/boards";
import type { TextElement } from "@/types/whiteboard";

function currentBoardStorageKey(): string {
  return whiteboardApi.getStorageKey(getCurrentBoardIdSync());
}

function createWrapper(): {
  wrapper: ({ children }: { children: ReactNode }) => JSX.Element;
  queryClient: QueryClient;
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

describe("useWhiteboardQuery", () => {
  beforeEach(() => {
    localStorage.removeItem(currentBoardStorageKey());
    vi.restoreAllMocks();
  });

  it("returns empty elements and isPending false when storage is empty", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWhiteboardQuery(), { wrapper });

    expect(result.current.elements).toEqual([]);
    expect(result.current.isPending).toBe(false);
    expect(typeof result.current.setElements).toBe("function");
  });

  it("returns stored elements from getWhiteboardSync when storage has data", () => {
    const stored: TextElement[] = [
      {
        id: "el-1",
        kind: "text",
        x: 10,
        y: 20,
        content: "Hello",
      },
    ];
    localStorage.setItem(
      currentBoardStorageKey(),
      JSON.stringify({ elements: stored })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWhiteboardQuery(), { wrapper });

    expect(result.current.elements).toHaveLength(1);
    expect(result.current.elements[0]).toMatchObject({
      id: "el-1",
      kind: "text",
      content: "Hello",
    });
  });

  it("setElements with new array updates cache and calls setWhiteboard", async () => {
    const setWhiteboardSpy = vi.spyOn(whiteboardApi, "setWhiteboard").mockResolvedValue();

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useWhiteboardQuery(), { wrapper });

    expect(result.current.elements).toEqual([]);

    const newElement: TextElement = {
      id: "new-1",
      kind: "text",
      x: 0,
      y: 0,
      content: "New",
    };

    act(() => {
      result.current.setElements([newElement]);
    });

    const boardId = getCurrentBoardIdSync();
    const queryKey = getWhiteboardQueryKey(boardId);
    const cached = queryClient.getQueryData<{ elements: TextElement[] }>(queryKey);
    expect(cached?.elements).toHaveLength(1);
    expect(cached?.elements[0]).toMatchObject(newElement);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    // Hook calls setWhiteboard(state, boardId); accept either one or two args
    expect(setWhiteboardSpy).toHaveBeenCalledWith(
      expect.objectContaining({ elements: [newElement] }),
      expect.any(String)
    );
  });

  it("setElements with updater function applies to previous state and calls setWhiteboard", async () => {
    const setWhiteboardSpy = vi.spyOn(whiteboardApi, "setWhiteboard").mockResolvedValue();

    const initial: TextElement[] = [
      { id: "a", kind: "text", x: 0, y: 0, content: "A" },
    ];
    localStorage.setItem(currentBoardStorageKey(), JSON.stringify({ elements: initial }));

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useWhiteboardQuery(), { wrapper });

    act(() => {
      result.current.setElements((prev) => [
        ...prev,
        { id: "b", kind: "text", x: 10, y: 10, content: "B" },
      ]);
    });

    const boardId = getCurrentBoardIdSync();
    const queryKey = getWhiteboardQueryKey(boardId);
    const cached = queryClient.getQueryData<{ elements: TextElement[] }>(queryKey);
    expect(cached?.elements).toHaveLength(2);
    expect(cached?.elements[0]?.content).toBe("A");
    expect(cached?.elements[1]?.content).toBe("B");

    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    expect(setWhiteboardSpy).toHaveBeenCalledTimes(1);
    const state = setWhiteboardSpy.mock.calls[0]?.[0];
    expect(state).toBeDefined();
    expect(state?.elements).toHaveLength(2);
    expect(state?.elements[0]).toMatchObject({ content: "A" });
    expect(state?.elements[1]).toMatchObject({ content: "B" });
  });

  it("exports getWhiteboardQueryKey for cache access", () => {
    const boardId = "test-board";
    const queryKey = getWhiteboardQueryKey(boardId);
    expect(queryKey).toEqual(["whiteboard", "test-board"]);
  });

  it("provides undo and redo functionality", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWhiteboardQuery(), { wrapper });

    expect(typeof result.current.undo).toBe("function");
    expect(typeof result.current.redo).toBe("function");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("allows undoing changes", async () => {
    vi.spyOn(whiteboardApi, "setWhiteboard").mockResolvedValue();

    const initial: TextElement[] = [
      { id: "a", kind: "text", x: 0, y: 0, content: "A" },
    ];
    localStorage.setItem(currentBoardStorageKey(), JSON.stringify({ elements: initial }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWhiteboardQuery(), { wrapper });

    const withB: TextElement[] = [
      ...initial,
      { id: "b", kind: "text", x: 10, y: 10, content: "B" },
    ];

    act(() => {
      result.current.setElements(withB);
    });

    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });

    expect(result.current.elements).toEqual(initial);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });
  });

  it("allows redoing changes", async () => {
    vi.spyOn(whiteboardApi, "setWhiteboard").mockResolvedValue();

    const initial: TextElement[] = [
      { id: "a", kind: "text", x: 0, y: 0, content: "A" },
    ];
    localStorage.setItem(currentBoardStorageKey(), JSON.stringify({ elements: initial }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWhiteboardQuery(), { wrapper });

    const withB: TextElement[] = [
      ...initial,
      { id: "b", kind: "text", x: 10, y: 10, content: "B" },
    ];

    act(() => {
      result.current.setElements(withB);
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });

    expect(result.current.elements).toEqual(withB);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    await act(async () => {
      await Promise.resolve();
    });
  });

  it("clears redo history when making new change after undo", async () => {
    vi.spyOn(whiteboardApi, "setWhiteboard").mockResolvedValue();

    const initial: TextElement[] = [
      { id: "a", kind: "text", x: 0, y: 0, content: "A" },
    ];
    localStorage.setItem(currentBoardStorageKey(), JSON.stringify({ elements: initial }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWhiteboardQuery(), { wrapper });

    const withB: TextElement[] = [
      ...initial,
      { id: "b", kind: "text", x: 10, y: 10, content: "B" },
    ];

    act(() => {
      result.current.setElements(withB);
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    const withC: TextElement[] = [
      ...initial,
      { id: "c", kind: "text", x: 20, y: 20, content: "C" },
    ];

    act(() => {
      result.current.setElements(withC);
    });

    expect(result.current.elements).toEqual(withC);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    await act(async () => {
      await Promise.resolve();
    });
  });

  it("passes through options parameter to setElements", async () => {
    vi.spyOn(whiteboardApi, "setWhiteboard").mockResolvedValue();

    const initial: TextElement[] = [
      { id: "a", kind: "text", x: 0, y: 0, content: "A" },
    ];
    localStorage.setItem(currentBoardStorageKey(), JSON.stringify({ elements: initial }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWhiteboardQuery(), { wrapper });

    const withB: TextElement[] = [
      ...initial,
      { id: "b", kind: "text", x: 10, y: 10, content: "B" },
    ];

    act(() => {
      result.current.setElements(withB);
    });

    expect(result.current.canUndo).toBe(true);

    const withC: TextElement[] = [
      ...withB,
      { id: "c", kind: "text", x: 20, y: 20, content: "C" },
    ];

    act(() => {
      result.current.setElements(withC, { skipHistory: true });
    });

    expect(result.current.elements).toEqual(withC);
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });

    expect(result.current.elements).toEqual(initial);

    await act(async () => {
      await Promise.resolve();
    });
  });
});
