import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Listens for mousedown (capture) and calls onClose when the click is outside
 * all of the given refs. Use for dropdowns/popovers that should close on outside click.
 */
export function useCloseOnOutsideClick(
  isOpen: boolean,
  onClose: () => void,
  ...refs: Array<RefObject<HTMLElement | null | undefined>>
): void {
  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent): void => {
      const target = e.target as Node;
      const inside = refs.some((r) => r.current?.contains(target));
      if (!inside) onClose();
    };
    document.addEventListener("mousedown", close, { capture: true });
    return () => document.removeEventListener("mousedown", close, { capture: true });
    // Refs are RefObjects (stable); including refs would re-run when call site passes new array ref
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs identity is not semantically significant
  }, [isOpen, onClose]);
}
