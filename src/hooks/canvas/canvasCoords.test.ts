import { describe, it, expect } from "vitest";
import {
  clientToViewBox,
  clientToWorld,
  viewBoxToClient,
  viewBoxToWorld,
  worldToClient,
  worldToViewBox,
} from "./canvasCoords";

function createMockElement(rect: {
  left: number;
  top: number;
  width: number;
  height: number;
}): Element {
  const el = document.createElement("div");
  el.getBoundingClientRect = () => rect as DOMRect;
  return el;
}

describe("clientToViewBox", () => {
  it("returns null when element is null", () => {
    expect(
      clientToViewBox(null, 100, 100, 800, 600)
    ).toBeNull();
  });

  it("returns null when viewBox dimensions are non-positive", () => {
    const el = createMockElement({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    });
    expect(clientToViewBox(el, 100, 100, 0, 600)).toBeNull();
    expect(clientToViewBox(el, 100, 100, 800, 0)).toBeNull();
    expect(clientToViewBox(el, 100, 100, -100, 600)).toBeNull();
  });

  it("returns null when element has zero dimensions", () => {
    const el = createMockElement({
      left: 0,
      top: 0,
      width: 0,
      height: 600,
    });
    expect(clientToViewBox(el, 100, 100, 800, 600)).toBeNull();

    const el2 = createMockElement({
      left: 0,
      top: 0,
      width: 800,
      height: 0,
    });
    expect(clientToViewBox(el2, 100, 100, 800, 600)).toBeNull();
  });

  it("converts client coords to viewBox coords with correct scaling", () => {
    const el = createMockElement({
      left: 100,
      top: 50,
      width: 800,
      height: 600,
    });
    // Client center: (500, 350); viewBox 800x600
    // Scale: viewBox/rect = 1:1, so client (500,350) -> viewBox (400, 300)
    const result = clientToViewBox(el, 500, 350, 800, 600);
    expect(result).toEqual({ x: 400, y: 300 });
  });

  it("handles offset from element origin", () => {
    const el = createMockElement({
      left: 200,
      top: 100,
      width: 400,
      height: 300,
    });
    // Client at element top-left (200, 100) -> viewBox (0, 0)
    const result = clientToViewBox(el, 200, 100, 800, 600);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it("scales when viewBox differs from client rect", () => {
    const el = createMockElement({
      left: 0,
      top: 0,
      width: 400,
      height: 300,
    });
    // ViewBox 800x600, rect 400x300 -> scale 2x
    // Client (200, 150) is center of rect -> viewBox (400, 300)
    const result = clientToViewBox(el, 200, 150, 800, 600);
    expect(result).toEqual({ x: 400, y: 300 });
  });
});

describe("viewBoxToWorld", () => {
  it("converts with no pan and zoom 1", () => {
    const result = viewBoxToWorld(100, 50, 0, 0, 1);
    expect(result).toEqual({ x: 100, y: 50 });
  });

  it("applies pan offset", () => {
    const result = viewBoxToWorld(100, 50, 200, 100, 1);
    expect(result).toEqual({ x: -100, y: -50 });
  });

  it("applies zoom scaling", () => {
    const result = viewBoxToWorld(200, 100, 0, 0, 2);
    expect(result).toEqual({ x: 100, y: 50 });
  });

  it("combines pan and zoom", () => {
    const result = viewBoxToWorld(400, 300, 100, 50, 2);
    expect(result).toEqual({ x: 150, y: 125 });
  });
});

describe("clientToWorld", () => {
  it("returns null when zoom is invalid", () => {
    const el = createMockElement({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    });
    expect(
      clientToWorld(el, 400, 300, 800, 600, 0, 0, 0)
    ).toBeNull();
    expect(
      clientToWorld(el, 400, 300, 800, 600, 0, 0, -1)
    ).toBeNull();
    expect(
      clientToWorld(el, 400, 300, 800, 600, 0, 0, Number.NaN)
    ).toBeNull();
    expect(
      clientToWorld(el, 400, 300, 800, 600, 0, 0, Number.POSITIVE_INFINITY)
    ).toBeNull();
  });

  it("returns null when clientToViewBox fails", () => {
    expect(
      clientToWorld(null, 100, 100, 800, 600, 0, 0, 1)
    ).toBeNull();
  });

  it("converts client to world coordinates", () => {
    const el = createMockElement({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    });
    // Client (400, 300) -> viewBox (400, 300) -> world (400, 300) with pan 0, zoom 1
    const result = clientToWorld(el, 400, 300, 800, 600, 0, 0, 1);
    expect(result).toEqual({ x: 400, y: 300 });
  });

  it("applies pan and zoom in world conversion", () => {
    const el = createMockElement({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    });
    // viewBox (400, 300), pan (100, 50), zoom 2 -> world (150, 125)
    const result = clientToWorld(el, 400, 300, 800, 600, 100, 50, 2);
    expect(result).toEqual({ x: 150, y: 125 });
  });
});

describe("worldToViewBox", () => {
  it("converts with no pan and zoom 1", () => {
    const result = worldToViewBox(100, 50, 0, 0, 1);
    expect(result).toEqual({ x: 100, y: 50 });
  });

  it("applies pan offset", () => {
    const result = worldToViewBox(100, 50, 200, 100, 1);
    expect(result).toEqual({ x: 300, y: 150 });
  });

  it("applies zoom scaling", () => {
    const result = worldToViewBox(100, 50, 0, 0, 2);
    expect(result).toEqual({ x: 200, y: 100 });
  });

  it("inverts viewBoxToWorld", () => {
    const world = viewBoxToWorld(400, 300, 100, 50, 2);
    const vb = worldToViewBox(world.x, world.y, 100, 50, 2);
    expect(vb).toEqual({ x: 400, y: 300 });
  });
});

describe("viewBoxToClient", () => {
  it("returns null when element is null", () => {
    expect(viewBoxToClient(null, 0, 0, 800, 600)).toBeNull();
  });

  it("returns null when viewBox dimensions are non-positive", () => {
    const el = createMockElement({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    });
    expect(viewBoxToClient(el, 0, 0, 0, 600)).toBeNull();
    expect(viewBoxToClient(el, 0, 0, 800, 0)).toBeNull();
  });

  it("returns null when element has zero dimensions", () => {
    const el = createMockElement({
      left: 0,
      top: 0,
      width: 0,
      height: 600,
    });
    expect(viewBoxToClient(el, 400, 300, 800, 600)).toBeNull();
  });

  it("converts viewBox coords to client coords", () => {
    const el = createMockElement({
      left: 100,
      top: 50,
      width: 800,
      height: 600,
    });
    // viewBox (0, 0) -> client at rect top-left (100, 50)
    const result = viewBoxToClient(el, 0, 0, 800, 600);
    expect(result).toEqual({ x: 100, y: 50 });
  });

  it("inverts clientToViewBox", () => {
    const el = createMockElement({
      left: 100,
      top: 50,
      width: 800,
      height: 600,
    });
    const vb = clientToViewBox(el, 500, 350, 800, 600);
    expect(vb).not.toBeNull();
    const client = viewBoxToClient(el, vb!.x, vb!.y, 800, 600);
    expect(client).toEqual({ x: 500, y: 350 });
  });
});

describe("worldToClient", () => {
  it("returns null when viewBoxToClient fails", () => {
    expect(
      worldToClient(null, 100, 100, 800, 600, 0, 0, 1)
    ).toBeNull();
  });

  it("converts world to client coordinates", () => {
    const el = createMockElement({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    });
    // world (400, 300), pan 0, zoom 1 -> viewBox (400, 300) -> client (400, 300)
    const result = worldToClient(el, 400, 300, 800, 600, 0, 0, 1);
    expect(result).toEqual({ x: 400, y: 300 });
  });

  it("inverts clientToWorld round-trip", () => {
    const el = createMockElement({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    });
    const world = clientToWorld(el, 400, 300, 800, 600, 100, 50, 2);
    expect(world).not.toBeNull();
    const client = worldToClient(
      el,
      world!.x,
      world!.y,
      800,
      600,
      100,
      50,
      2
    );
    expect(client).toEqual({ x: 400, y: 300 });
  });
});
