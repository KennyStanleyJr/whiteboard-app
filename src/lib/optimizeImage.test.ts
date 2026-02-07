import { describe, it, expect } from "vitest";
import {
  scaledDimensions,
  OPTIMIZE_IMAGE_MAX_DIMENSION,
  OPTIMIZE_IMAGE_JPEG_QUALITY,
} from "./optimizeImage";

describe("optimizeImage", () => {
  describe("scaledDimensions", () => {
    const max = OPTIMIZE_IMAGE_MAX_DIMENSION;

    it("returns original dimensions when both within max", () => {
      expect(scaledDimensions(100, 100, max)).toEqual({ width: 100, height: 100 });
      expect(scaledDimensions(max, max, max)).toEqual({
        width: max,
        height: max,
      });
    });

    it("scales down when width exceeds max", () => {
      const w = max + 1000;
      const h = 500;
      const out = scaledDimensions(w, h, max);
      expect(out.width).toBe(max);
      expect(out.height).toBe(Math.round((500 * max) / w));
    });

    it("scales down when height exceeds max", () => {
      const w = 500;
      const h = max + 1000;
      const out = scaledDimensions(w, h, max);
      expect(out.height).toBe(max);
      expect(out.width).toBe(Math.round((500 * max) / h));
    });

    it("uses scale from larger dimension", () => {
      const out = scaledDimensions(3000, 2000, max);
      expect(out.width).toBe(max);
      expect(out.height).toBe(Math.round((2000 * max) / 3000));
    });

    it("avoids division by zero when dimensions are zero", () => {
      const out = scaledDimensions(0, 0, max);
      expect(out).toEqual({ width: 0, height: 0 });
    });
  });

  describe("constants", () => {
    it("uses a reasonable max dimension", () => {
      expect(OPTIMIZE_IMAGE_MAX_DIMENSION).toBe(2048);
    });
    it("uses a reasonable JPEG quality", () => {
      expect(OPTIMIZE_IMAGE_JPEG_QUALITY).toBeGreaterThan(0);
      expect(OPTIMIZE_IMAGE_JPEG_QUALITY).toBeLessThanOrEqual(1);
    });
  });
});
