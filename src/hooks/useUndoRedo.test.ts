import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUndoRedo } from "./useUndoRedo";
import type { TextElement, WhiteboardElement } from "@/types/whiteboard";

function createTextElement(id: string, content: string): TextElement {
  return {
    id,
    kind: "text",
    x: 0,
    y: 0,
    content,
  };
}

describe("useUndoRedo", () => {
  it("initializes with provided elements", () => {
    const initial: WhiteboardElement[] = [createTextElement("a", "A")];
    const { result } = renderHook(() => useUndoRedo(initial));

    expect(result.current.elements).toEqual(initial);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("allows undoing after making changes", () => {
    const initial: WhiteboardElement[] = [createTextElement("a", "A")];
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => {
      result.current.setElements([...initial, createTextElement("b", "B")]);
    });

    expect(result.current.elements).toHaveLength(2);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.undo();
    });

    expect(result.current.elements).toEqual(initial);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it("allows redoing after undoing", () => {
    const initial: WhiteboardElement[] = [createTextElement("a", "A")];
    const { result } = renderHook(() => useUndoRedo(initial));

    const withB = [...initial, createTextElement("b", "B")];
    act(() => {
      result.current.setElements(withB);
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.elements).toEqual(initial);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });

    expect(result.current.elements).toEqual(withB);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("clears redo history when making new change after undo", () => {
    const initial: WhiteboardElement[] = [createTextElement("a", "A")];
    const { result } = renderHook(() => useUndoRedo(initial));

    const withB = [...initial, createTextElement("b", "B")];
    act(() => {
      result.current.setElements(withB);
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    const withC = [...initial, createTextElement("c", "C")];
    act(() => {
      result.current.setElements(withC);
    });

    expect(result.current.elements).toEqual(withC);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("skipHistory option updates present without adding to history", () => {
    const initial: WhiteboardElement[] = [createTextElement("a", "A")];
    const { result } = renderHook(() => useUndoRedo(initial));

    const withB = [...initial, createTextElement("b", "B")];
    act(() => {
      result.current.setElements(withB);
    });

    expect(result.current.canUndo).toBe(true);

    const withC = [...withB, createTextElement("c", "C")];
    act(() => {
      result.current.setElements(withC, { skipHistory: true });
    });

    expect(result.current.elements).toEqual(withC);
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });

    expect(result.current.elements).toEqual(initial);
  });

  it("pushToPast option pushes to history without changing present", () => {
    const initial: WhiteboardElement[] = [createTextElement("a", "A")];
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => {
      result.current.setElements((prev) => prev, { pushToPast: true });
    });

    expect(result.current.elements).toEqual(initial);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.undo();
    });

    expect(result.current.elements).toEqual(initial);
  });

  it("pushToPast clears redo history", () => {
    const initial: WhiteboardElement[] = [createTextElement("a", "A")];
    const { result } = renderHook(() => useUndoRedo(initial));

    const withB = [...initial, createTextElement("b", "B")];
    act(() => {
      result.current.setElements(withB);
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.setElements((prev) => prev, { pushToPast: true });
    });

    expect(result.current.canRedo).toBe(false);
  });

  it("handles multiple undo/redo operations", () => {
    const initial: WhiteboardElement[] = [createTextElement("a", "A")];
    const { result } = renderHook(() => useUndoRedo(initial));

    const withB = [...initial, createTextElement("b", "B")];
    act(() => {
      result.current.setElements(withB);
    });

    const withC = [...withB, createTextElement("c", "C")];
    act(() => {
      result.current.setElements(withC);
    });

    expect(result.current.elements).toEqual(withC);

    act(() => {
      result.current.undo();
    });
    expect(result.current.elements).toEqual(withB);

    act(() => {
      result.current.undo();
    });
    expect(result.current.elements).toEqual(initial);

    act(() => {
      result.current.redo();
    });
    expect(result.current.elements).toEqual(withB);

    act(() => {
      result.current.redo();
    });
    expect(result.current.elements).toEqual(withC);
  });

  it("does not add to history if elements are unchanged", () => {
    const initial: WhiteboardElement[] = [createTextElement("a", "A")];
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => {
      result.current.setElements(initial);
    });

    expect(result.current.canUndo).toBe(false);
  });

  it("handles updater function form of setElements", () => {
    const initial: WhiteboardElement[] = [createTextElement("a", "A")];
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => {
      result.current.setElements((prev) => [
        ...prev,
        createTextElement("b", "B"),
      ]);
    });

    expect(result.current.elements).toHaveLength(2);
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });

    expect(result.current.elements).toEqual(initial);
  });

  it("maintains separate element instances in history", () => {
    const initial: WhiteboardElement[] = [createTextElement("a", "A")];
    const { result } = renderHook(() => useUndoRedo(initial));

    const modified: WhiteboardElement[] = [
      { ...initial[0]!, kind: "text", content: "Modified" },
    ];

    act(() => {
      result.current.setElements(modified);
    });

    const firstEl = result.current.elements[0];
    expect(firstEl?.kind).toBe("text");
    if (firstEl?.kind === "text") {
      expect(firstEl.content).toBe("Modified");
    }

    act(() => {
      result.current.undo();
    });

    const restoredEl = result.current.elements[0];
    expect(restoredEl?.kind).toBe("text");
    if (restoredEl?.kind === "text") {
      expect(restoredEl.content).toBe("A");
    }
    expect(result.current.elements[0]).not.toBe(initial[0]);
  });

  it("replaceState replaces full history for board switching", () => {
    const initial: WhiteboardElement[] = [createTextElement("a", "A")];
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => {
      result.current.setElements([...initial, createTextElement("b", "B")]);
    });
    expect(result.current.canUndo).toBe(true);

    const otherBoardPresent = [createTextElement("x", "X")];
    act(() => {
      result.current.replaceState({
        past: [],
        present: otherBoardPresent,
        future: [],
      });
    });

    expect(result.current.elements).toEqual(otherBoardPresent);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("calls onHistoryChange when history changes (skips initial empty state)", () => {
    const initial: WhiteboardElement[] = [createTextElement("a", "A")];
    const onHistoryChange = vi.fn();
    const { result } = renderHook(() =>
      useUndoRedo(initial, { onHistoryChange })
    );

    expect(onHistoryChange).not.toHaveBeenCalled();

    act(() => {
      result.current.setElements([...initial, createTextElement("b", "B")]);
    });
    expect(onHistoryChange).toHaveBeenCalledWith(
      expect.objectContaining({
        past: expect.any(Array) as unknown as WhiteboardElement[],
        present: expect.any(Array) as unknown as WhiteboardElement[],
        future: [],
      })
    );
  });
});
