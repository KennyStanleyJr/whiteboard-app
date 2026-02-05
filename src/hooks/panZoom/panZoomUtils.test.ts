import {
  clampZoom,
  zoomAtPoint,
  applyTouchPinch,
  isTwoFingerTap,
  createTouchGestureState,
  touchCenterAndDistance,
  MIN_ZOOM,
  MAX_ZOOM,
} from "./panZoomUtils";

function createTouchList(
  t1: { clientX: number; clientY: number },
  t2: { clientX: number; clientY: number }
): TouchList {
  return { 0: t1, 1: t2, length: 2 } as unknown as TouchList;
}

describe("clampZoom", () => {
  it("returns value within bounds unchanged", () => {
    expect(clampZoom(1, 0.1, 5)).toBe(1);
    expect(clampZoom(2.5, 0.1, 5)).toBe(2.5);
  });

  it("clamps below min", () => {
    expect(clampZoom(0.05, MIN_ZOOM, MAX_ZOOM)).toBe(MIN_ZOOM);
    expect(clampZoom(-1, 0.1, 5)).toBe(0.1);
  });

  it("clamps above max", () => {
    expect(clampZoom(10, MIN_ZOOM, MAX_ZOOM)).toBe(MAX_ZOOM);
    expect(clampZoom(6, 0.1, 5)).toBe(5);
  });
});

describe("zoomAtPoint", () => {
  it("keeps world point under cursor fixed when zooming", () => {
    const result = zoomAtPoint(100, 100, 50, 50, 1, 2);
    const worldX = (100 - result.panX) / 2;
    const worldY = (100 - result.panY) / 2;
    const origWorldX = (100 - 50) / 1;
    const origWorldY = (100 - 50) / 1;
    expect(worldX).toBeCloseTo(origWorldX);
    expect(worldY).toBeCloseTo(origWorldY);
  });

  it("returns different pan when zoom changes", () => {
    const result = zoomAtPoint(0, 0, 100, 100, 1, 2);
    expect(result.panX).not.toBe(100);
    expect(result.panY).not.toBe(100);
  });
});

describe("applyTouchPinch", () => {
  const g = createTouchGestureState(100, 100, 100, 0, 0, 1);

  it("scales zoom by distance ratio", () => {
    const result = applyTouchPinch(g, 100, 100, 200, MIN_ZOOM, MAX_ZOOM);
    expect(result.nextZoom).toBe(2);
  });

  it("respects min/max zoom bounds", () => {
    const result = applyTouchPinch(g, 100, 100, 1000, MIN_ZOOM, MAX_ZOOM);
    expect(result.nextZoom).toBe(MAX_ZOOM);
  });
});

describe("touchCenterAndDistance", () => {
  it("returns center and distance for two touches", () => {
    const touches = createTouchList({ clientX: 0, clientY: 0 }, { clientX: 100, clientY: 0 });
    const result = touchCenterAndDistance(touches);
    expect(result.cx).toBe(50);
    expect(result.cy).toBe(0);
    expect(result.dist).toBe(100);
  });

  it("returns distance for diagonal touches", () => {
    const touches = createTouchList({ clientX: 0, clientY: 0 }, { clientX: 3, clientY: 4 });
    const result = touchCenterAndDistance(touches);
    expect(result.cx).toBe(1.5);
    expect(result.cy).toBe(2);
    expect(result.dist).toBe(5);
  });

  it("returns default when touch is missing", () => {
    const touches = { 0: { clientX: 0, clientY: 0 }, length: 1 } as unknown as TouchList;
    const result = touchCenterAndDistance(touches);
    expect(result.cx).toBe(0);
    expect(result.cy).toBe(0);
    expect(result.dist).toBe(1);
  });
});

describe("createTouchGestureState", () => {
  it("returns state with correct fields", () => {
    const g = createTouchGestureState(10, 20, 50, 5, 5, 1);
    expect(g.centerX).toBe(10);
    expect(g.centerY).toBe(20);
    expect(g.distance).toBe(50);
    expect(g.panX).toBe(5);
    expect(g.panY).toBe(5);
    expect(g.zoom).toBe(1);
    expect(g.movedEnough).toBe(false);
    expect(typeof g.startTime).toBe("number");
  });
});

describe("isTwoFingerTap", () => {
  it("returns true when not moved and short duration", () => {
    const g = createTouchGestureState(100, 100, 50, 0, 0, 1);
    expect(isTwoFingerTap(g, 100)).toBe(true);
  });

  it("returns false when moved enough", () => {
    const g = createTouchGestureState(100, 100, 50, 0, 0, 1);
    g.movedEnough = true;
    expect(isTwoFingerTap(g, 100)).toBe(false);
  });

  it("returns false when duration exceeds tap threshold", () => {
    const g = createTouchGestureState(100, 100, 50, 0, 0, 1);
    expect(isTwoFingerTap(g, 500)).toBe(false);
  });
});
