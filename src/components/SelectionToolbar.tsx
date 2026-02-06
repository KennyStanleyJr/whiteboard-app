import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { worldToClient } from "@/hooks/canvas/canvasCoords";
import type { ElementBounds } from "@/utils/elementBounds";
import {
  getElementBounds,
  sanitizeElementBounds,
} from "@/utils/elementBounds";
import type {
  TextAlign,
  TextElement,
  TextVerticalAlign,
  WhiteboardElement,
} from "@/types/whiteboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ChevronDown,
  ChevronUp,
  TypeIcon,
} from "lucide-react";

const TOOLBAR_OFFSET_PX = 8;

/** Preset font sizes in the dropdown (px); wider range, fewer close values. */
const FONT_SIZE_PRESETS = [8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 96];

const MIN_FONT_SIZE = 1;
const MAX_FONT_SIZE = 999;

export interface SelectionToolbarProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  selectedElementIds: string[];
  elements: WhiteboardElement[];
  setElements: React.Dispatch<React.SetStateAction<WhiteboardElement[]>>;
  measuredBounds: Record<string, ElementBounds>;
  panX: number;
  panY: number;
  zoom: number;
  viewWidth: number;
  viewHeight: number;
}

function unionBounds(
  bounds: ElementBounds[]
): ElementBounds | null {
  if (bounds.length === 0) return null;
  let minX = bounds[0]!.x;
  let minY = bounds[0]!.y;
  let maxX = bounds[0]!.x + bounds[0]!.width;
  let maxY = bounds[0]!.y + bounds[0]!.height;
  for (let i = 1; i < bounds.length; i++) {
    const b = bounds[i]!;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function SelectionToolbar(props: SelectionToolbarProps): JSX.Element | null {
  const {
    containerRef,
    selectedElementIds,
    elements,
    setElements,
    measuredBounds,
    panX,
    panY,
    zoom,
    viewWidth,
    viewHeight,
  } = props;

  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const alignMenuRef = useRef<HTMLDivElement | null>(null);
  const verticalAlignMenuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [alignMenuOpen, setAlignMenuOpen] = useState(false);
  const [verticalAlignMenuOpen, setVerticalAlignMenuOpen] = useState(false);
  const worldAnchorRef = useRef<{ centerX: number; topY: number } | null>(null);

  const selectedTextElements = elements.filter(
    (el): el is TextElement =>
      selectedElementIds.includes(el.id) && el.kind === "text"
  );
  const hasText = selectedTextElements.length > 0;
  const firstText = selectedTextElements[0];
  const fontSizeValues = selectedTextElements.map((el) => el.fontSize ?? 16);
  const singleFontSize =
    fontSizeValues.length > 0 && fontSizeValues.every((v) => v === fontSizeValues[0]);
  const displayFontSize = firstText?.fontSize ?? 16;
  const displayTextAlign = (firstText?.textAlign ?? "left") satisfies TextAlign;
  const displayVerticalAlign = (firstText?.textVerticalAlign ?? "top") satisfies TextVerticalAlign;

  useLayoutEffect(() => {
    if (
      selectedElementIds.length === 0 ||
      containerRef.current == null ||
      viewWidth <= 0 ||
      viewHeight <= 0
    ) {
      setPosition(null);
      return;
    }
    const boundsList: ElementBounds[] = [];
    for (const id of selectedElementIds) {
      const el = elements.find((e) => e.id === id);
      if (el == null) continue;
      boundsList.push(getElementBounds(el, measuredBounds));
    }
    const union = unionBounds(boundsList);
    if (union == null) {
      setPosition(null);
      return;
    }
    const centerX = union.x + union.width / 2;
    const topY = union.y;
    worldAnchorRef.current = { centerX, topY };
    const client = worldToClient(
      containerRef.current,
      centerX,
      topY,
      viewWidth,
      viewHeight,
      panX,
      panY,
      zoom
    );
    if (client == null) {
      setPosition(null);
      return;
    }
    const toolbarEl = toolbarRef.current;
    const toolbarHeight = toolbarEl?.getBoundingClientRect().height ?? 48;
    setPosition({
      left: client.x,
      top: client.y - toolbarHeight - TOOLBAR_OFFSET_PX,
    });
  }, [
    selectedElementIds,
    elements,
    measuredBounds,
    panX,
    panY,
    zoom,
    viewWidth,
    viewHeight,
    containerRef,
  ]);

  useLayoutEffect(() => {
    if (
      position == null ||
      containerRef.current == null ||
      toolbarRef.current == null ||
      worldAnchorRef.current == null ||
      viewWidth <= 0 ||
      viewHeight <= 0
    ) {
      return;
    }
    const { centerX, topY } = worldAnchorRef.current;
    const client = worldToClient(
      containerRef.current,
      centerX,
      topY,
      viewWidth,
      viewHeight,
      panX,
      panY,
      zoom
    );
    if (client == null) return;
    const rect = toolbarRef.current.getBoundingClientRect();
    const top = client.y - rect.height - TOOLBAR_OFFSET_PX;
    if (Math.abs(top - position.top) > 0.5) {
      setPosition((prev) => (prev != null ? { ...prev, top } : null));
    }
  }, [
    position,
    panX,
    panY,
    zoom,
    viewWidth,
    viewHeight,
    containerRef,
  ]);

  const applyFontSize = (num: number): void => {
    const clamped = Math.round(
      Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, num))
    );
    setElements((prev) =>
      prev.map((el) => {
        if (el.kind !== "text" || !selectedElementIds.includes(el.id))
          return el;
        const next = { ...el, fontSize: clamped, fontSizeUnit: "px" as const };
        // If no explicit size yet, fix size to current bounds so text wraps
        // in the same box instead of extending past the selection box.
        const hasExplicitSize =
          el.width !== undefined &&
          el.height !== undefined &&
          el.width > 0 &&
          el.height > 0;
        if (!hasExplicitSize) {
          const raw = measuredBounds[el.id] ?? getElementBounds(el);
          const b = sanitizeElementBounds(raw);
          next.width = b.width;
          next.height = b.height;
        }
        return next;
      })
    );
  };

  const applyTextAlign = (align: TextAlign): void => {
    setElements((prev) =>
      prev.map((el) => {
        if (el.kind !== "text" || !selectedElementIds.includes(el.id))
          return el;
        return { ...el, textAlign: align };
      })
    );
  };

  const applyVerticalAlign = (align: TextVerticalAlign): void => {
    setElements((prev) =>
      prev.map((el) => {
        if (el.kind !== "text" || !selectedElementIds.includes(el.id))
          return el;
        return { ...el, textVerticalAlign: align };
      })
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value;
    if (raw === "") return;
    const num = Number.parseFloat(raw);
    if (Number.isNaN(num)) return;
    applyFontSize(num);
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>): void => {
    const raw = e.target.value.trim();
    if (raw === "") {
      applyFontSize(displayFontSize);
      return;
    }
    const num = Number.parseFloat(raw);
    if (!Number.isNaN(num)) applyFontSize(num);
  };

  useEffect(() => {
    if (!alignMenuOpen) return;
    const close = (e: MouseEvent): void => {
      const el = alignMenuRef.current;
      if (el != null && !el.contains(e.target as Node)) setAlignMenuOpen(false);
    };
    document.addEventListener("mousedown", close, { capture: true });
    return () => document.removeEventListener("mousedown", close, { capture: true });
  }, [alignMenuOpen]);

  useEffect(() => {
    if (!verticalAlignMenuOpen) return;
    const close = (e: MouseEvent): void => {
      const el = verticalAlignMenuRef.current;
      if (el != null && !el.contains(e.target as Node))
        setVerticalAlignMenuOpen(false);
    };
    document.addEventListener("mousedown", close, { capture: true });
    return () => document.removeEventListener("mousedown", close, { capture: true });
  }, [verticalAlignMenuOpen]);

  const presetValue =
    singleFontSize && FONT_SIZE_PRESETS.includes(displayFontSize)
      ? String(displayFontSize)
      : "";

  if (selectedElementIds.length === 0) return null;
  if (position == null) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1.5 rounded-md border border-border bg-popover px-2 py-1.5 shadow-md"
      style={{
        left: position.left,
        top: position.top,
        transform: "translate(-50%, 0)",
      }}
      role="toolbar"
      aria-label="Element options"
    >
      {hasText && (
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
                    applyTextAlign("left");
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
                    applyTextAlign("center");
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
                    applyTextAlign("right");
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
                    applyVerticalAlign("top");
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
                    applyVerticalAlign("middle");
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
                    applyVerticalAlign("bottom");
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
          <div className="flex items-center gap-1.5">
            <TypeIcon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="flex items-center overflow-hidden rounded-lg border border-border bg-transparent">
              <div className="flex flex-col border-r border-border pl-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-2.5 w-4 min-w-0 rounded-tl-lg rounded-b-none border-b border-border !pl-1 !pr-1 !py-0 text-muted-foreground [&_svg]:size-[3px] [&_svg]:opacity-50"
                  onClick={() => applyFontSize(displayFontSize + 1)}
                  aria-label="Increase font size"
                >
                  <ChevronUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-2.5 w-4 min-w-0 rounded-bl-lg rounded-t-none !pl-1 !pr-1 !py-0 text-muted-foreground [&_svg]:size-[3px] [&_svg]:opacity-50"
                  onClick={() => applyFontSize(displayFontSize - 1)}
                  aria-label="Decrease font size"
                >
                  <ChevronDown aria-hidden />
                </Button>
              </div>
              <Input
                type="number"
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                value={singleFontSize ? displayFontSize : ""}
                placeholder={singleFontSize ? undefined : "—"}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                className="h-5 w-8 border-0 bg-transparent px-1 py-0 text-right text-[8px] leading-none text-muted-foreground shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Font size"
              />
              <Select
                value={presetValue}
                onValueChange={(v) => {
                  const num = Number(v);
                  if (FONT_SIZE_PRESETS.includes(num)) applyFontSize(num);
                }}
              >
                <SelectTrigger
                  className="!h-5 w-5 min-h-0 border-0 border-l border-border rounded-none rounded-r-lg bg-transparent px-0 py-0 shadow-none focus:ring-0 flex justify-center items-center [&_[data-slot=select-value]]:hidden [&_svg]:size-3.5"
                  aria-label="Font size presets"
                >
                  <SelectValue placeholder="…" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="center"
                  sideOffset={4}
                  className="min-w-0 w-14"
                >
                  {FONT_SIZE_PRESETS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
