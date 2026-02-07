import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { worldToClient } from "@/hooks/canvas/canvasCoords";
import type { ElementBounds } from "@/utils/elementBounds";
import {
  getElementBounds,
  sanitizeElementBounds,
} from "@/utils/elementBounds";
import { innerContentIfSingleColorSpan } from "@/utils/sanitizeHtml";
import {
  addFormatToContent,
  hasFormat,
  removeFormatFromContent,
  type FormatTag,
} from "@/utils/textFormat";
import type {
  ImageCornerRadius,
  ImageElement,
  ShapeElement,
  TextAlign,
  TextElement,
  TextVerticalAlign,
  WhiteboardElement,
} from "@/types/whiteboard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Maximize2, PaintBucket } from "lucide-react";
import { AlignMenus } from "./AlignMenus";
import { ElementActionsMenu } from "./ElementContextMenu";
import { FontSizeControl } from "./FontSizeControl";
import { FormatButtonsRow } from "./FormatButtonsRow";
import { ImageCornerRadiusMenu } from "./ImageCornerRadiusMenu";
import { ToolbarColorPicker } from "./ToolbarColorPicker";
import {
  COLOR_APPLY_THROTTLE_MS,
  FONT_SIZE_PRESETS,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  parseHexFromContent,
  TOOLBAR_OFFSET_PX,
  unionBounds,
} from "./selectionToolbarUtils";

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
  /** When set, format commands apply to the active editor; otherwise to whole element content. */
  editingElementId?: string | null;
  /** Run a format command on the active contentEditable (bold, italic, underline, foreColor). */
  onFormatCommand?: (command: string, value?: string) => void;
  /** Handler for cutting selected elements */
  onCut?: () => void;
  /** Handler for copying selected elements */
  onCopy?: () => void;
  /** Handler for duplicating selected elements */
  onDuplicate?: () => void;
  /** Handler for deleting selected elements */
  onDelete?: () => void;
  /** When provided and a single image is selected, "Get info" is shown in the element actions menu. */
  onGetImageInfo?: () => void;
}

export interface SelectionToolbarHandle {
  applyBold: () => void;
  applyItalic: () => void;
  applyUnderline: () => void;
  toggleShapeFilled: () => void;
}

export const SelectionToolbar = forwardRef<
  SelectionToolbarHandle,
  SelectionToolbarProps
>(function SelectionToolbar(props, ref): JSX.Element | null {
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
    editingElementId = null,
    onFormatCommand,
    onCut,
    onCopy,
    onDuplicate,
    onDelete,
    onGetImageInfo,
  } = props;

  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const alignMenuRef = useRef<HTMLDivElement>(null);
  const verticalAlignMenuRef = useRef<HTMLDivElement>(null);
  const colorPickerMenuRef = useRef<HTMLDivElement>(null);
  const cornerRadiusMenuRef = useRef<HTMLDivElement>(null);
  const elementActionsMenuRef = useRef<HTMLDivElement>(null);
  const applyColorRef = useRef<(color: string) => void>(() => {});
  const colorThrottleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorLastApplyTimeRef = useRef<number>(0);
  const pendingHexRef = useRef<string | null>(null);
  const colorPickerElementIdsRef = useRef<Set<string>>(new Set());

  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [alignMenuOpen, setAlignMenuOpen] = useState(false);
  const [verticalAlignMenuOpen, setVerticalAlignMenuOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [cornerRadiusMenuOpen, setCornerRadiusMenuOpen] = useState(false);
  const [elementActionsMenuOpen, setElementActionsMenuOpen] = useState(false);
  const [pickerColor, setPickerColor] = useState("#000000");
  const worldAnchorRef = useRef<{ centerX: number; topY: number } | null>(null);
  const lastPositionRef = useRef<{ left: number; top: number } | null>(null);

  const selectedTextElements = elements.filter(
    (el): el is TextElement =>
      selectedElementIds.includes(el.id) && el.kind === "text"
  );
  const selectedShapeElements = elements.filter(
    (el): el is ShapeElement =>
      selectedElementIds.includes(el.id) && el.kind === "shape"
  );
  const selectedImageElements = elements.filter(
    (el): el is ImageElement =>
      selectedElementIds.includes(el.id) && el.kind === "image"
  );
  const hasText = selectedTextElements.length > 0;
  const hasShape = selectedShapeElements.length > 0;
  const hasImage = selectedImageElements.length > 0;
  const firstText = selectedTextElements[0];
  const firstShape = selectedShapeElements[0];
  const firstImage = selectedImageElements[0];
  const displayImageFill = firstImage?.imageFill ?? false;
  const displayImageCornerRadius: ImageCornerRadius =
    firstImage?.imageCornerRadius ?? "none";
  const displayShapeFilled =
    hasShape &&
    selectedShapeElements.every((el) => el.filled !== false);
  const shapeFillMixed =
    hasShape &&
    selectedShapeElements.some((el) => el.filled === true) &&
    selectedShapeElements.some((el) => el.filled === false);
  const fontSizeValues = selectedTextElements.map((el) => el.fontSize ?? 24);
  const singleFontSize =
    fontSizeValues.length > 0 && fontSizeValues.every((v) => v === fontSizeValues[0]);
  const displayFontSize = firstText?.fontSize ?? 24;
  const displayTextAlign = (firstText?.textAlign ?? "left") satisfies TextAlign;
  const displayVerticalAlign = (firstText?.textVerticalAlign ?? "top") satisfies TextVerticalAlign;
  const displayBold =
    hasText && selectedTextElements.every((el) => hasFormat(el.content, "b"));
  const displayItalic =
    hasText && selectedTextElements.every((el) => hasFormat(el.content, "i"));
  const displayUnderline =
    hasText && selectedTextElements.every((el) => hasFormat(el.content, "u"));

  const isEditingSelected =
    editingElementId != null && selectedElementIds.includes(editingElementId);
  const canUseFormatCommand = isEditingSelected && onFormatCommand != null;

  const applyFormatToSelection = useCallback(
    (command: string, value?: string): void => {
      if (canUseFormatCommand) {
        onFormatCommand(command, value);
        return;
      }
      if (command === "foreColor" && value) {
        const hex = value.startsWith("#") ? value : `#${value}`;
        flushSync(() => {
          setElements((prev) =>
            prev.map((el) => {
              if (el.kind !== "text" || !selectedElementIds.includes(el.id))
                return el;
              const inner = innerContentIfSingleColorSpan(el.content);
              const raw = inner.trim() || " ";
              return {
                ...el,
                content: `<span style="color: ${hex}">${raw}</span>`,
              };
            })
          );
        });
        return;
      }
      const formatTag: FormatTag =
        command === "bold" ? "b" : command === "italic" ? "i" : "u";
      setElements((prev) => {
        const selected = prev.filter(
          (el): el is TextElement =>
            el.kind === "text" && selectedElementIds.includes(el.id)
        );
        const allHaveFormat =
          selected.length > 0 &&
          selected.every((el) => hasFormat(el.content, formatTag));
        const apply = allHaveFormat ? removeFormatFromContent : addFormatToContent;
        return prev.map((el) => {
          if (el.kind !== "text" || !selectedElementIds.includes(el.id))
            return el;
          return { ...el, content: apply(el.content, formatTag) };
        });
      });
    },
    [
      canUseFormatCommand,
      onFormatCommand,
      setElements,
      selectedElementIds,
    ]
  );

  const applyBold = useCallback(
    (): void => applyFormatToSelection("bold"),
    [applyFormatToSelection]
  );
  const applyItalic = useCallback(
    (): void => applyFormatToSelection("italic"),
    [applyFormatToSelection]
  );
  const applyUnderline = useCallback(
    (): void => applyFormatToSelection("underline"),
    [applyFormatToSelection]
  );

  const applyShapeFilled = useCallback(
    (filled: boolean): void => {
      setElements((prev) =>
        prev.map((el) => {
          if (el.kind !== "shape" || !selectedElementIds.includes(el.id))
            return el;
          return { ...el, filled };
        })
      );
    },
    [selectedElementIds, setElements]
  );

  const handleShapeFilledToggle = useCallback((): void => {
    if (shapeFillMixed) {
      // If mixed, set all to filled
      applyShapeFilled(true);
    } else {
      // Otherwise toggle to opposite
      applyShapeFilled(!displayShapeFilled);
    }
  }, [shapeFillMixed, displayShapeFilled, applyShapeFilled]);

  const handleImageFillToggle = useCallback((): void => {
    const next = !displayImageFill;
    setElements((prev) =>
      prev.map((el) => {
        if (el.kind !== "image" || !selectedElementIds.includes(el.id))
          return el;
        return { ...el, imageFill: next };
      })
    );
  }, [displayImageFill, selectedElementIds, setElements]);

  const applyImageCornerRadius = useCallback(
    (value: ImageCornerRadius): void => {
      setElements((prev) =>
        prev.map((el) => {
          if (el.kind !== "image" || !selectedElementIds.includes(el.id))
            return el;
          return { ...el, imageCornerRadius: value };
        })
      );
    },
    [selectedElementIds, setElements]
  );

  // Close color picker when selection changes (only if IDs actually changed)
  const prevSelectedIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const prevIds = prevSelectedIdsRef.current;
    const currentIds = selectedElementIds;
    const prevSet = new Set(prevIds);
    const currentSet = new Set(currentIds);
    const idsChanged =
      prevIds.length !== currentIds.length ||
      prevIds.some((id) => !currentSet.has(id)) ||
      currentIds.some((id) => !prevSet.has(id));
    if (idsChanged && colorPickerOpen) {
      setColorPickerOpen(false);
    }
    prevSelectedIdsRef.current = currentIds;
  }, [selectedElementIds, colorPickerOpen]);

  useImperativeHandle(
    ref,
    () => ({ applyBold, applyItalic, applyUnderline, toggleShapeFilled: handleShapeFilledToggle }),
    [applyBold, applyItalic, applyUnderline, handleShapeFilledToggle]
  );

  applyColorRef.current = (color: string) => {
    const targetIds = colorPickerElementIdsRef.current;
    const hex = color.startsWith("#") ? color : `#${color}`;
    setElements((prev) =>
      prev.map((el) => {
        if (!targetIds.has(el.id)) return el;
        if (el.kind === "text") {
          const inner = innerContentIfSingleColorSpan(el.content);
          const raw = inner.trim() || " ";
          return {
            ...el,
            content: `<span style="color: ${hex}">${raw}</span>`,
          };
        }
        if (el.kind === "shape") {
          return { ...el, color: hex };
        }
        return el;
      })
    );
  };

  const applyColorThrottled = useCallback((hex: string) => {
    pendingHexRef.current = hex;
    const now = Date.now();
    const elapsed = now - colorLastApplyTimeRef.current;
    const apply = (): void => {
      const toApply = pendingHexRef.current;
      if (toApply) {
        applyColorRef.current(toApply);
        colorLastApplyTimeRef.current = Date.now();
      }
      colorThrottleTimeoutRef.current = null;
    };
    if (elapsed >= COLOR_APPLY_THROTTLE_MS || colorLastApplyTimeRef.current === 0) {
      apply();
    } else if (colorThrottleTimeoutRef.current == null) {
      colorThrottleTimeoutRef.current = setTimeout(
        apply,
        COLOR_APPLY_THROTTLE_MS - elapsed
      );
    }
  }, []);

  const closeColorPicker = useCallback(() => {
    if (colorThrottleTimeoutRef.current != null) {
      clearTimeout(colorThrottleTimeoutRef.current);
      colorThrottleTimeoutRef.current = null;
    }
    if (pendingHexRef.current) {
      applyColorRef.current(pendingHexRef.current);
      pendingHexRef.current = null;
    }
    colorPickerElementIdsRef.current.clear();
    setColorPickerOpen(false);
  }, []);

  const onPickerColorChange = useCallback(
    (hex: string) => {
      setPickerColor(hex);
      applyColorThrottled(hex);
    },
    [applyColorThrottled]
  );

  useLayoutEffect(() => {
    if (
      selectedElementIds.length === 0 ||
      containerRef.current == null ||
      viewWidth <= 0 ||
      viewHeight <= 0
    ) {
      lastPositionRef.current = null;
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
      lastPositionRef.current = null;
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
      lastPositionRef.current = null;
      setPosition(null);
      return;
    }
    const toolbarEl = toolbarRef.current;
    const toolbarHeight = toolbarEl?.getBoundingClientRect().height ?? 48;
    const newPosition = {
      left: client.x,
      top: client.y - toolbarHeight - TOOLBAR_OFFSET_PX,
    };
    // Only update position if it actually changed to prevent infinite loops
    const lastPos = lastPositionRef.current;
    if (
      lastPos == null ||
      Math.abs(lastPos.left - newPosition.left) > 0.5 ||
      Math.abs(lastPos.top - newPosition.top) > 0.5
    ) {
      lastPositionRef.current = newPosition;
      setPosition(newPosition);
    }
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
        const next = { ...el, fontSize: clamped };
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

  const handleDeleteSelected = (): void => {
    if (onDelete) {
      onDelete();
    } else {
      const ids = new Set(selectedElementIds);
      setElements((prev) => prev.filter((el) => !ids.has(el.id)));
    }
  };

  const handleSendToBack = (): void => {
    const ids = new Set(selectedElementIds);
    setElements((prev) => {
      const selected: WhiteboardElement[] = [];
      const unselected: WhiteboardElement[] = [];
      for (const el of prev) {
        if (ids.has(el.id)) {
          selected.push(el);
        } else {
          unselected.push(el);
        }
      }
      // Selected elements go to the beginning (back)
      return [...selected, ...unselected];
    });
  };

  const handleSendToFront = (): void => {
    const ids = new Set(selectedElementIds);
    setElements((prev) => {
      const selected: WhiteboardElement[] = [];
      const unselected: WhiteboardElement[] = [];
      for (const el of prev) {
        if (ids.has(el.id)) {
          selected.push(el);
        } else {
          unselected.push(el);
        }
      }
      // Selected elements go to the end (front)
      return [...unselected, ...selected];
    });
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

  useEffect(() => {
    if (!colorPickerOpen) return;
    const close = (e: MouseEvent): void => {
      const el = colorPickerMenuRef.current;
      if (el != null && !el.contains(e.target as Node)) closeColorPicker();
    };
    document.addEventListener("mousedown", close, { capture: true });
    return () => document.removeEventListener("mousedown", close, { capture: true });
  }, [colorPickerOpen, closeColorPicker]);

  useEffect(() => {
    if (!cornerRadiusMenuOpen) return;
    const close = (e: MouseEvent): void => {
      const el = cornerRadiusMenuRef.current;
      if (el != null && !el.contains(e.target as Node))
        setCornerRadiusMenuOpen(false);
    };
    document.addEventListener("mousedown", close, { capture: true });
    return () => document.removeEventListener("mousedown", close, { capture: true });
  }, [cornerRadiusMenuOpen]);

  useEffect(() => {
    if (!elementActionsMenuOpen) return;
    const close = (e: MouseEvent): void => {
      const el = elementActionsMenuRef.current;
      if (el != null && !el.contains(e.target as Node))
        setElementActionsMenuOpen(false);
    };
    document.addEventListener("mousedown", close, { capture: true });
    return () => document.removeEventListener("mousedown", close, { capture: true });
  }, [elementActionsMenuOpen]);

  const presetValue =
    singleFontSize && FONT_SIZE_PRESETS.includes(displayFontSize)
      ? String(displayFontSize)
      : "";

  if (selectedElementIds.length === 0) return null;
  if (position == null) return null;

  return (
    <div
      ref={toolbarRef}
      className="selection-toolbar fixed z-50 flex items-stretch gap-1.5 rounded-md border px-2 py-1.5 shadow-md"
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
          <FormatButtonsRow
            displayBold={displayBold}
            displayItalic={displayItalic}
            displayUnderline={displayUnderline}
            onBold={applyBold}
            onItalic={applyItalic}
            onUnderline={applyUnderline}
          />
          <FontSizeControl
            displayFontSize={displayFontSize}
            singleFontSize={singleFontSize}
            presetValue={presetValue}
            onFontSizeChange={applyFontSize}
            onInputChange={handleInputChange}
            onInputBlur={handleInputBlur}
          />
          <AlignMenus
            displayTextAlign={displayTextAlign}
            displayVerticalAlign={displayVerticalAlign}
            onTextAlign={applyTextAlign}
            onVerticalAlign={applyVerticalAlign}
            alignMenuOpen={alignMenuOpen}
            verticalAlignMenuOpen={verticalAlignMenuOpen}
            setAlignMenuOpen={setAlignMenuOpen}
            setVerticalAlignMenuOpen={setVerticalAlignMenuOpen}
            alignMenuRef={alignMenuRef}
            verticalAlignMenuRef={verticalAlignMenuRef}
          />
        </>
      )}
      {hasShape && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 rounded [&_svg]:size-3.5",
            displayShapeFilled && "bg-accent"
          )}
          onClick={handleShapeFilledToggle}
          aria-label={
            shapeFillMixed
              ? "Fill all shapes"
              : displayShapeFilled
                ? "Switch to outline"
                : "Switch to filled"
          }
          aria-pressed={displayShapeFilled}
        >
          <PaintBucket aria-hidden />
        </Button>
      )}
      {hasImage && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded [&_svg]:size-3.5",
              displayImageFill && "bg-accent"
            )}
            onClick={handleImageFillToggle}
            aria-label={
              displayImageFill
                ? "Disable fill container (preserve image aspect ratio)"
                : "Enable fill container (match container aspect ratio)"
            }
            aria-pressed={displayImageFill}
          >
            <Maximize2 aria-hidden />
          </Button>
          <ImageCornerRadiusMenu
            displayCornerRadius={displayImageCornerRadius}
            onCornerRadiusChange={applyImageCornerRadius}
            menuOpen={cornerRadiusMenuOpen}
            setMenuOpen={setCornerRadiusMenuOpen}
            menuRef={cornerRadiusMenuRef}
          />
        </>
      )}
      {(hasText || hasShape) && (
        <ToolbarColorPicker
          colorPickerOpen={colorPickerOpen}
          pickerColor={pickerColor}
          onPickerColorChange={onPickerColorChange}
          onColorPickerToggle={() => {
            if (colorPickerOpen) closeColorPicker();
            else {
              colorPickerElementIdsRef.current = new Set(selectedElementIds);
              if (firstShape != null)
                setPickerColor(firstShape.color ?? "#000000");
              else if (firstText?.content)
                setPickerColor(parseHexFromContent(firstText.content));
              else setPickerColor("#000000");
              setColorPickerOpen(true);
            }
          }}
          colorPickerMenuRef={colorPickerMenuRef}
        />
      )}
      <ElementActionsMenu
        onCut={onCut ?? (() => {})}
        onCopy={onCopy ?? (() => {})}
        onDuplicate={onDuplicate ?? (() => {})}
        onDelete={handleDeleteSelected}
        onSendToBack={handleSendToBack}
        onSendToFront={handleSendToFront}
        onGetImageInfo={
          selectedElementIds.length === 1 && hasImage
            ? onGetImageInfo
            : undefined
        }
        menuOpen={elementActionsMenuOpen}
        setMenuOpen={setElementActionsMenuOpen}
        menuRef={elementActionsMenuRef}
      />
    </div>
  );
});
