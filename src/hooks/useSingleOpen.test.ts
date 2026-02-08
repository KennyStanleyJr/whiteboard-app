import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSingleOpen } from "./useSingleOpen";

describe("useSingleOpen", () => {
  it("returns null and actions when initial is null", () => {
    const { result } = renderHook(() => useSingleOpen<string>(null));
    const [value, actions] = result.current;
    expect(value).toBe(null);
    expect(actions.open).toBeDefined();
    expect(actions.close).toBeDefined();
    expect(actions.toggle).toBeDefined();
    expect(actions.isOpen).toBeDefined();
  });

  it("returns initial value when provided", () => {
    const { result } = renderHook(() => useSingleOpen<string>("menu-a"));
    expect(result.current[0]).toBe("menu-a");
    expect(result.current[1].isOpen("menu-a")).toBe(true);
  });

  it("open(id) sets the open value", () => {
    const { result } = renderHook(() => useSingleOpen<string>(null));
    act(() => {
      result.current[1].open("align");
    });
    expect(result.current[0]).toBe("align");
    expect(result.current[1].isOpen("align")).toBe(true);
    expect(result.current[1].isOpen("color")).toBe(false);
  });

  it("open(null) closes", () => {
    const { result } = renderHook(() => useSingleOpen<string>("align"));
    act(() => {
      result.current[1].open(null);
    });
    expect(result.current[0]).toBe(null);
    expect(result.current[1].isOpen("align")).toBe(false);
  });

  it("close() sets value to null", () => {
    const { result } = renderHook(() => useSingleOpen<string>("align"));
    act(() => {
      result.current[1].close();
    });
    expect(result.current[0]).toBe(null);
  });

  it("toggle(id) opens when closed", () => {
    const { result } = renderHook(() => useSingleOpen<string>(null));
    act(() => {
      result.current[1].toggle("align");
    });
    expect(result.current[0]).toBe("align");
  });

  it("toggle(id) closes when already open", () => {
    const { result } = renderHook(() => useSingleOpen<string>("align"));
    act(() => {
      result.current[1].toggle("align");
    });
    expect(result.current[0]).toBe(null);
  });

  it("toggle(id) switches to another id when different one is open", () => {
    const { result } = renderHook(() => useSingleOpen<string>(null));
    act(() => {
      result.current[1].open("align");
    });
    act(() => {
      result.current[1].toggle("color");
    });
    expect(result.current[0]).toBe("color");
    expect(result.current[1].isOpen("align")).toBe(false);
    expect(result.current[1].isOpen("color")).toBe(true);
  });

  it("only one value is open at a time", () => {
    const { result } = renderHook(() => useSingleOpen<string>(null));
    act(() => {
      result.current[1].open("a");
    });
    act(() => {
      result.current[1].open("b");
    });
    expect(result.current[0]).toBe("b");
    expect(result.current[1].isOpen("a")).toBe(false);
    expect(result.current[1].isOpen("b")).toBe(true);
  });
});
