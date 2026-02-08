import type { TextAlign, TextVerticalAlign } from "@/types/whiteboard";
import { createPortal } from "react-dom";
import { useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
} from "lucide-react";
import { usePortalContainer } from "@/contexts/PortalContainerContext";

export interface AlignMenusProps {
  displayTextAlign: TextAlign;
  displayVerticalAlign: TextVerticalAlign;
  onTextAlign: (align: TextAlign) => void;
  onVerticalAlign: (align: TextVerticalAlign) => void;
  alignMenuOpen: boolean;
  verticalAlignMenuOpen: boolean;
  setAlignMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setVerticalAlignMenuOpen: (
    open: boolean | ((prev: boolean) => boolean)
  ) => void;
  alignMenuRef: React.RefObject<HTMLDivElement>;
  verticalAlignMenuRef: React.RefObject<HTMLDivElement>;
  /** Ref for the open portaled dropdown (align or vertical; only one is open at a time). */
  alignDropdownRef: React.RefObject<HTMLDivElement>;
  /** When true, alignment cannot be changed (e.g. text fill mode). */
  disabled?: boolean;
}

const DROPDOWN_OFFSET_PX = 4;
const DROPDOWN_CLASS =
  "fixed z-[60] flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border bg-popover px-1 py-1 shadow-md";

function useDropdownPosition(
  open: boolean,
  triggerRef: React.RefObject<HTMLDivElement | null>
): { left: number; top: number } | null {
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open || triggerRef.current == null) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      left: rect.left + rect.width / 2,
      top: rect.bottom + DROPDOWN_OFFSET_PX,
    });
  }, [open, triggerRef]);

  return position;
}

export function AlignMenus({
  displayTextAlign,
  displayVerticalAlign,
  onTextAlign,
  onVerticalAlign,
  alignMenuOpen,
  verticalAlignMenuOpen,
  setAlignMenuOpen,
  setVerticalAlignMenuOpen,
  alignMenuRef,
  verticalAlignMenuRef,
  alignDropdownRef,
  disabled = false,
}: AlignMenusProps): JSX.Element {
  const portalTarget = usePortalContainer() ?? document.body;
  const alignPosition = useDropdownPosition(alignMenuOpen, alignMenuRef);
  const verticalAlignPosition = useDropdownPosition(
    verticalAlignMenuOpen,
    verticalAlignMenuRef
  );

  const alignDropdown =
    alignMenuOpen &&
    alignPosition != null &&
    createPortal(
      <div
        ref={alignDropdownRef}
        className={DROPDOWN_CLASS}
        role="menu"
        aria-label="Alignment options"
        style={{ left: alignPosition.left, top: alignPosition.top }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded [&_svg]:size-3.5"
          onClick={() => {
            onTextAlign("left");
            setAlignMenuOpen(false);
          }}
          role="menuitem"
          aria-label="Align left"
          data-state={displayTextAlign === "left" ? "active" : undefined}
        >
          <AlignLeft aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded [&_svg]:size-3.5"
          onClick={() => {
            onTextAlign("center");
            setAlignMenuOpen(false);
          }}
          role="menuitem"
          aria-label="Align center"
          data-state={displayTextAlign === "center" ? "active" : undefined}
        >
          <AlignCenter aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded [&_svg]:size-3.5"
          onClick={() => {
            onTextAlign("right");
            setAlignMenuOpen(false);
          }}
          role="menuitem"
          aria-label="Align right"
          data-state={displayTextAlign === "right" ? "active" : undefined}
        >
          <AlignRight aria-hidden />
        </Button>
      </div>,
      portalTarget
    );

  const verticalAlignDropdown =
    verticalAlignMenuOpen &&
    verticalAlignPosition != null &&
    createPortal(
      <div
        ref={alignDropdownRef}
        className={DROPDOWN_CLASS}
        role="menu"
        aria-label="Vertical alignment options"
        style={{
          left: verticalAlignPosition.left,
          top: verticalAlignPosition.top,
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded [&_svg]:size-3.5"
          onClick={() => {
            onVerticalAlign("top");
            setVerticalAlignMenuOpen(false);
          }}
          role="menuitem"
          aria-label="Align top"
          data-state={
            displayVerticalAlign === "top" ? "active" : undefined
          }
        >
          <AlignVerticalJustifyStart aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded [&_svg]:size-3.5"
          onClick={() => {
            onVerticalAlign("middle");
            setVerticalAlignMenuOpen(false);
          }}
          role="menuitem"
          aria-label="Align middle"
          data-state={
            displayVerticalAlign === "middle" ? "active" : undefined
          }
        >
          <AlignVerticalJustifyCenter aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded [&_svg]:size-3.5"
          onClick={() => {
            onVerticalAlign("bottom");
            setVerticalAlignMenuOpen(false);
          }}
          role="menuitem"
          aria-label="Align bottom"
          data-state={
            displayVerticalAlign === "bottom" ? "active" : undefined
          }
        >
          <AlignVerticalJustifyEnd aria-hidden />
        </Button>
      </div>,
      portalTarget
    );

  return (
    <>
      {alignDropdown}
      {verticalAlignDropdown}
      <div
        ref={alignMenuRef}
        className="relative flex items-center"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded [&_svg]:size-3.5"
          onClick={() => !disabled && setAlignMenuOpen((open) => !open)}
          aria-label="Text alignment"
          aria-expanded={alignMenuOpen}
          aria-haspopup="menu"
          data-state={alignMenuOpen ? "active" : undefined}
          disabled={disabled}
        >
          {displayTextAlign === "left" && <AlignLeft aria-hidden />}
          {displayTextAlign === "center" && <AlignCenter aria-hidden />}
          {displayTextAlign === "right" && <AlignRight aria-hidden />}
        </Button>
      </div>
      <div
        ref={verticalAlignMenuRef}
        className="relative flex items-center"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded [&_svg]:size-3.5"
          onClick={() =>
            !disabled && setVerticalAlignMenuOpen((open) => !open)
          }
          aria-label="Vertical alignment"
          aria-expanded={verticalAlignMenuOpen}
          aria-haspopup="menu"
          data-state={verticalAlignMenuOpen ? "active" : undefined}
          disabled={disabled}
        >
          {displayVerticalAlign === "top" && (
            <AlignVerticalJustifyStart aria-hidden />
          )}
          {displayVerticalAlign === "middle" && (
            <AlignVerticalJustifyCenter aria-hidden />
          )}
          {displayVerticalAlign === "bottom" && (
            <AlignVerticalJustifyEnd aria-hidden />
          )}
        </Button>
      </div>
    </>
  );
}
