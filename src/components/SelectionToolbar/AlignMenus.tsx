import type { TextAlign, TextVerticalAlign } from "@/types/whiteboard";
import { Button } from "@/components/ui/button";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
} from "lucide-react";

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
}: AlignMenusProps): JSX.Element {
  return (
    <>
      <div
        ref={alignMenuRef}
        className="relative flex items-center border-r border-border pr-1.5"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded [&_svg]:size-3.5"
          onClick={() => setAlignMenuOpen((open) => !open)}
          aria-label="Text alignment"
          aria-expanded={alignMenuOpen}
          aria-haspopup="menu"
          data-state={alignMenuOpen ? "active" : undefined}
        >
          {displayTextAlign === "left" && <AlignLeft aria-hidden />}
          {displayTextAlign === "center" && <AlignCenter aria-hidden />}
          {displayTextAlign === "right" && <AlignRight aria-hidden />}
        </Button>
        {alignMenuOpen && (
          <div
            className="absolute left-1/2 top-full z-[60] mt-1 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border bg-popover px-1 py-1 shadow-md"
            role="menu"
            aria-label="Alignment options"
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
              data-state={
                displayTextAlign === "center" ? "active" : undefined
              }
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
          </div>
        )}
      </div>
      <div
        ref={verticalAlignMenuRef}
        className="relative flex items-center border-r border-border pr-1.5"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded [&_svg]:size-3.5"
          onClick={() => setVerticalAlignMenuOpen((open) => !open)}
          aria-label="Vertical alignment"
          aria-expanded={verticalAlignMenuOpen}
          aria-haspopup="menu"
          data-state={verticalAlignMenuOpen ? "active" : undefined}
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
        {verticalAlignMenuOpen && (
          <div
            className="absolute left-1/2 top-full z-[60] mt-1 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border bg-popover px-1 py-1 shadow-md"
            role="menu"
            aria-label="Vertical alignment options"
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
          </div>
        )}
      </div>
    </>
  );
}
