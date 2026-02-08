import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useReducer,
  useRef,
} from "react";
import { useCloseOnOutsideClick } from "@/hooks/useCloseOnOutsideClick";
import { useSingleOpen } from "@/hooks/useSingleOpen";
import { flushSync } from "react-dom";
import { worldToClient } from "@/hooks/canvas/canvasCoords";
import type { ElementBounds } from "@/lib/elementBounds";
import {
  getElementBounds,
  sanitizeElementBounds,
} from "@/lib/elementBounds";
import { innerContentIfSingleColorSpan } from "@/lib/sanitizeHtml";
import {
  addFormatToContent,
  hasFormat,
  removeFormatFromContent,
  type FormatTag,
} from "@/lib/textFormat";
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
  reorderElementsBySelection,
  TOOLBAR_OFFSET_PX,
  unionBounds,
} from "./selectionToolbarUtils";

function getToolbarDisplayPosition(
  fallback: { left: number; top: number },
  anchor: { centerX: number; topY: number } | null,
  container: HTMLElement | null,
  viewWidth: number,
  viewHeight: number,
  panX: number,
  panY: number,
  zoom: number,
  toolbarHeight: number
): { left: number; top: number } {
  if (!anchor || !container || viewWidth <= 0 || viewHeight <= 0)
    return fallback;
  const client = worldToClient(
    container,
    anchor.centerX,
    anchor.topY,
    viewWidth,
    viewHeight,
    panX,
    panY,
    zoom
  );
  return client != null
    ? { left: client.x, top: client.y - toolbarHeight - TOOLBAR_OFFSET_PX }
    : fallback;
}

/** Which submenu is open; only one at a time (useSingleOpen). */
export type ToolbarMenuId =
  | "align"
  | "verticalAlign"
  | "colorPicker"
  | "cornerRadius"
  | "elementActions";

/** Reducer: toolbar position and color picker value. Open menu state is in useSingleOpen. */
type ToolbarState = {
  position: { left: number; top: number } | null;
  pickerColor: string;
};
type ToolbarAction =
  | { type: "SET_POSITION"; payload: { left: number; top: number } | null }
  | { type: "SET_PICKER_COLOR"; payload: string };

function toolbarReducer(state: ToolbarState, action: ToolbarAction): ToolbarState {
  switch (action.type) {
    case "SET_POSITION":
      return { ...state, position: action.payload };
    case "SET_PICKER_COLOR":
      return { ...state, pickerColor: action.payload };
    default:
      return state;
  }
}

const INITIAL_TOOLBAR_STATE: ToolbarState = {
  position: null,
  pickerColor: "#000000",
};

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
  /** For text in fill mode: returns the effective fontSize to bake when turning fill off. */
  getEffectiveFontSize?: (elementId: string) => number | undefined;
  /** For text in fill mode: returns fitted box size to bake when turning fill off (avoids wrap/shift). */
  getFillFittedSize?: (elementId: string) => { width: number; height: number } | undefined;
  /** When fill mode is turned on for text, register these ids so the box is shrunk to fitted size after first report. */
  onFillModeEnabled?: (elementIds: string[]) => void;
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
    getEffectiveFontSize,
    getFillFittedSize,
    onFillModeEnabled,
    onDuplicate,
    onDelete,
    onGetImageInfo,
  } = props;

  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const alignMenuRef = useRef<HTMLDivElement>(null);
  const verticalAlignMenuRef = useRef<HTMLDivElement>(null);
  /** Ref for whichever align/vertical-align portaled dropdown is open (only one at a time). */
  const alignDropdownRef = useRef<HTMLDivElement>(null);
  const colorPickerMenuRef = useRef<HTMLDivElement>(null);
  const cornerRadiusMenuRef = useRef<HTMLDivElement>(null);
  const elementActionsMenuRef = useRef<HTMLDivElement>(null);
  const applyColorRef = useRef<(color: string) => void>(() => {});
  const colorThrottleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorLastApplyTimeRef = useRef<number>(0);
  const pendingHexRef = useRef<string | null>(null);
  const colorPickerElementIdsRef = useRef<Set<string>>(new Set());

  const [openMenu, menuActions] = useSingleOpen<ToolbarMenuId>(null);
  const [toolbarState, dispatchToolbar] = useReducer(
    toolbarReducer,
    INITIAL_TOOLBAR_STATE
  );
  const { position, pickerColor } = toolbarState;

  const alignMenuOpen = openMenu === "align";
  const verticalAlignMenuOpen = openMenu === "verticalAlign";
  const colorPickerOpen = openMenu === "colorPicker";
  const cornerRadiusMenuOpen = openMenu === "cornerRadius";
  const elementActionsMenuOpen = openMenu === "elementActions";

  /** Wrappers for child components that expect setOpen(boolean | (prev => boolean)). */
  type SetMenuOpen = (open: boolean | ((prev: boolean) => boolean)) => void;
  const setAlignMenuOpen: SetMenuOpen = useCallback((open) => {
    const next = typeof open === "function" ? open(alignMenuOpen) : open;
    menuActions.open(next ? "align" : null);
  }, [alignMenuOpen, menuActions]);
  const setVerticalAlignMenuOpen: SetMenuOpen = useCallback((open) => {
    const next = typeof open === "function" ? open(verticalAlignMenuOpen) : open;
    menuActions.open(next ? "verticalAlign" : null);
  }, [verticalAlignMenuOpen, menuActions]);
  const setCornerRadiusMenuOpen: SetMenuOpen = useCallback((open) => {
    const next = typeof open === "function" ? open(cornerRadiusMenuOpen) : open;
    menuActions.open(next ? "cornerRadius" : null);
  }, [cornerRadiusMenuOpen, menuActions]);
  const setElementActionsMenuOpen: SetMenuOpen = useCallback((open) => {
    const next = typeof open === "function" ? open(elementActionsMenuOpen) : open;
    menuActions.open(next ? "elementActions" : null);
  }, [elementActionsMenuOpen, menuActions]);
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
  const rawDisplayFontSize =
    firstText && firstText.fill !== false && getEffectiveFontSize
      ? getEffectiveFontSize(firstText.id) ?? firstText.fontSize ?? 24
      : firstText?.fontSize ?? 24;
  const displayFontSize = Math.round(rawDisplayFontSize);
  const displayTextAlign = (firstText?.textAlign ?? "left") satisfies TextAlign;
  const displayVerticalAlign = (firstText?.textVerticalAlign ?? "top") satisfies TextVerticalAlign;
  const displayTextFill = firstText?.fill !== false;
  const textFillMixed =
    hasText &&
    selectedTextElements.some((el) => el.fill === true) &&
    selectedTextElements.some((el) => el.fill === false);
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
      menuActions.close();
    }
    prevSelectedIdsRef.current = currentIds;
  }, [selectedElementIds, colorPickerOpen, menuActions]);

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
    menuActions.close();
  }, [menuActions]);

  const onPickerColorChange = useCallback(
    (hex: string) => {
      dispatchToolbar({ type: "SET_PICKER_COLOR", payload: hex });
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
      dispatchToolbar({ type: "SET_POSITION", payload: null });
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
      dispatchToolbar({ type: "SET_POSITION", payload: null });
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
      dispatchToolbar({ type: "SET_POSITION", payload: null });
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
      dispatchToolbar({ type: "SET_POSITION", payload: newPosition });
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

  const applyFontSize = (num: number): void => {
    const clamped = Math.round(
      Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, num))
    );
    setElements((prev) =>
      prev.map((el) => {
        if (el.kind !== "text" || !selectedElementIds.includes(el.id))
          return el;
        const next = { ...el, fontSize: clamped };
        const hasExplicitSize =
          el.width !== undefined &&
          el.height !== undefined &&
          el.width > 0 &&
          el.height > 0;
        if (hasExplicitSize && el.fill !== false && getEffectiveFontSize && getFillFittedSize) {
          const effective = getEffectiveFontSize(el.id);
          const fitted = getFillFittedSize(el.id);
          if (
            effective != null &&
            effective > 0 &&
            fitted != null &&
            fitted.width > 0 &&
            fitted.height > 0
          ) {
            const exactW = (fitted.width * clamped) / effective;
            const exactH = (fitted.height * clamped) / effective;
            next.width = Math.max(1, exactW);
            next.height = Math.max(1, exactH);
          }
        } else if (!hasExplicitSize) {
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

  const handleTextFillToggle = useCallback((): void => {
    const next = textFillMixed ? true : !displayTextFill;
    if (next) {
      const textIds = selectedElementIds.filter((id) =>
        elements.some((e) => e.id === id && e.kind === "text")
      );
      onFillModeEnabled?.(textIds);
    }
    setElements((prev) =>
      prev.map((el) => {
        if (el.kind !== "text" || !selectedElementIds.includes(el.id))
          return el;
        const updates: Partial<TextElement> = { fill: next };
        if (!next) {
          const effective = getEffectiveFontSize?.(el.id);
          if (effective != null)
            updates.fontSize = Math.max(1, Math.floor(effective));
          const fitted = getFillFittedSize?.(el.id);
          if (fitted != null) {
            updates.width = Math.max(1, fitted.width);
            updates.height = Math.max(1, fitted.height);
          }
        }
        return { ...el, ...updates };
      })
    );
  }, [
    displayTextFill,
    textFillMixed,
    selectedElementIds,
    elements,
    setElements,
    getEffectiveFontSize,
    getFillFittedSize,
    onFillModeEnabled,
  ]);

  const handleDeleteSelected = (): void => {
    if (onDelete) {
      onDelete();
    } else {
      const ids = new Set(selectedElementIds);
      setElements((prev) => prev.filter((el) => !ids.has(el.id)));
    }
  };

  const handleSendToBack = (): void => {
    setElements((prev) =>
      reorderElementsBySelection(prev, selectedElementIds, true)
    );
  };

  const handleSendToFront = (): void => {
    setElements((prev) =>
      reorderElementsBySelection(prev, selectedElementIds, false)
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

  useCloseOnOutsideClick(
    alignMenuOpen || verticalAlignMenuOpen,
    menuActions.close,
    alignMenuRef,
    verticalAlignMenuRef,
    alignDropdownRef
  );
  useCloseOnOutsideClick(colorPickerOpen, closeColorPicker, colorPickerMenuRef);
  useCloseOnOutsideClick(cornerRadiusMenuOpen, menuActions.close, cornerRadiusMenuRef);
  useCloseOnOutsideClick(elementActionsMenuOpen, menuActions.close, elementActionsMenuRef);

  const presetValue =
    singleFontSize && FONT_SIZE_PRESETS.includes(displayFontSize)
      ? String(displayFontSize)
      : "";

  if (selectedElementIds.length === 0) return null;
  if (position == null) return null;

  const displayPosition = getToolbarDisplayPosition(
    position,
    worldAnchorRef.current,
    containerRef.current,
    viewWidth,
    viewHeight,
    panX,
    panY,
    zoom,
    toolbarRef.current?.getBoundingClientRect().height ?? 48
  );

  return (
    <div
      ref={toolbarRef}
      className="selection-toolbar fixed z-[5] flex w-max items-stretch gap-1.5 rounded-md border px-2 py-1.5 shadow-md"
      style={{
        left: displayPosition.left,
        top: displayPosition.top,
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
          <div className="min-w-0 shrink-0">
            <FontSizeControl
              displayFontSize={displayFontSize}
              singleFontSize={singleFontSize}
              presetValue={presetValue}
              onFontSizeChange={applyFontSize}
              onInputChange={handleInputChange}
              onInputBlur={handleInputBlur}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 shrink-0 rounded [&_svg]:size-3.5",
              displayTextFill && "bg-accent"
            )}
            onClick={handleTextFillToggle}
            aria-label={
              textFillMixed
                ? "Fill text to box (on)"
                : displayTextFill
                  ? "Don't fill text to box"
                  : "Fill text to box"
            }
            aria-pressed={displayTextFill}
          >
            <Maximize2 aria-hidden />
          </Button>
          <div
            className={cn(
              "grid shrink-0 items-stretch transition-[grid-template-columns,margin] duration-200 ease-out",
              displayTextFill ? "grid-cols-[0fr] -mr-1.5" : "grid-cols-[1fr]"
            )}
          >
            <div className="min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5">
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
                  alignDropdownRef={alignDropdownRef}
                />
              </div>
            </div>
          </div>
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
                dispatchToolbar({ type: "SET_PICKER_COLOR", payload: firstShape.color ?? "#000000" });
              else if (firstText?.content)
                dispatchToolbar({ type: "SET_PICKER_COLOR", payload: parseHexFromContent(firstText.content) });
              else dispatchToolbar({ type: "SET_PICKER_COLOR", payload: "#000000" });
              menuActions.open("colorPicker");
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
