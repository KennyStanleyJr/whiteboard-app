import { useCallback, useRef } from "react";
import type { WhiteboardElement } from "@/types/whiteboard";

export interface FillModeResizeConstraints {
  fixedAspectRatio?: number;
  maxFillBoxSize?: { width: number; height: number };
}

/**
 * Holds refs and callbacks for text fill mode: effective font size, aspect ratio,
 * max box size, fitted size. Used by WhiteboardCanvas and SelectionToolbar.
 */
export function useFillModeTextState(
  setElements: React.Dispatch<React.SetStateAction<WhiteboardElement[]>>
) {
  const effectiveFontSizeByIdRef = useRef<Record<string, number>>({});
  const textAspectRatioByIdRef = useRef<Record<string, number>>({});
  const maxFillBoxSizeByIdRef = useRef<
    Record<string, { width: number; height: number }>
  >({});
  const fillFittedSizeByIdRef = useRef<
    Record<string, { width: number; height: number }>
  >({});
  const pendingFillOnFitIdsRef = useRef<Set<string>>(new Set());

  const handleEffectiveFontSize = useCallback(
    (elementId: string, effectiveFontSize: number) => {
      effectiveFontSizeByIdRef.current[elementId] = effectiveFontSize;
    },
    []
  );

  const getEffectiveFontSize = useCallback(
    (elementId: string): number | undefined =>
      effectiveFontSizeByIdRef.current[elementId],
    []
  );

  const handleTextAspectRatio = useCallback(
    (elementId: string, aspectRatio: number) => {
      if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return;
      textAspectRatioByIdRef.current[elementId] = aspectRatio;
    },
    []
  );

  const handleMaxFillBoxSize = useCallback(
    (elementId: string, maxWidth: number, maxHeight: number) => {
      if (!Number.isFinite(maxWidth) || !Number.isFinite(maxHeight) || maxWidth <= 0 || maxHeight <= 0)
        return;
      maxFillBoxSizeByIdRef.current[elementId] = { width: maxWidth, height: maxHeight };
    },
    []
  );

  const registerFillOnPendingFit = useCallback((elementIds: string[]) => {
    const set = pendingFillOnFitIdsRef.current;
    for (const id of elementIds) set.add(id);
  }, []);

  const EPSILON = 0.5;

  const handleFillFittedSize = useCallback(
    (elementId: string, width: number, height: number) => {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
        return;
      fillFittedSizeByIdRef.current[elementId] = { width, height };
      pendingFillOnFitIdsRef.current.delete(elementId);
      const w = Math.max(1, width);
      const h = Math.max(1, height);
      requestAnimationFrame(() => {
        setElements((prev) => {
          const el = prev.find((e) => e.kind === "text" && e.id === elementId);
          if (!el) return prev;
          const ew = el.width ?? 0;
          const eh = el.height ?? 0;
          if (Math.abs(ew - w) < EPSILON && Math.abs(eh - h) < EPSILON) return prev;
          return prev.map((e) =>
            e.kind === "text" && e.id === elementId
              ? { ...e, width: w, height: h }
              : e
          );
        });
      });
    },
    [setElements]
  );

  const getFillFittedSize = useCallback(
    (elementId: string): { width: number; height: number } | undefined =>
      fillFittedSizeByIdRef.current[elementId],
    []
  );

  const getResizeConstraints = useCallback(
    (elementId: string): FillModeResizeConstraints => {
      const out: FillModeResizeConstraints = {};
      const ratio = textAspectRatioByIdRef.current[elementId];
      if (ratio != null && Number.isFinite(ratio) && ratio > 0)
        out.fixedAspectRatio = ratio;
      const max = maxFillBoxSizeByIdRef.current[elementId];
      if (
        max != null &&
        max.width > 0 &&
        max.height > 0
      )
        out.maxFillBoxSize = max;
      return out;
    },
    []
  );

  return {
    handleEffectiveFontSize,
    getEffectiveFontSize,
    handleTextAspectRatio,
    handleMaxFillBoxSize,
    handleFillFittedSize,
    getFillFittedSize,
    registerFillOnPendingFit,
    getResizeConstraints,
  };
}
