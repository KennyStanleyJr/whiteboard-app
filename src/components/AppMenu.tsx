import { useRef, useReducer, useEffect, useLayoutEffect } from "react";
import { useSingleOpen } from "@/hooks/useSingleOpen";
import { createPortal } from "react-dom";
import { Menu, Download, Upload, Palette, Moon, Sun } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WhiteboardState } from "@/api/whiteboard";
import type { CanvasPreferences, GridStyle, Theme } from "@/lib/canvasPreferences";
import { cn } from "@/lib/utils";

/** Icon: no grid (single square outline). */
function GridIconEmpty({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4", className)}
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="1" />
    </svg>
  );
}

/** Icon: dotted grid (2x2 dots). */
function GridIconDotted({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-4", className)}
      {...props}
    >
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="16" cy="8" r="1.5" />
      <circle cx="8" cy="16" r="1.5" />
      <circle cx="16" cy="16" r="1.5" />
    </svg>
  );
}

/** Icon: grid-lined (full grid). */
function GridIconGridLined({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={cn("size-4", className)}
      {...props}
    >
      <line x1="3" y1="8" x2="21" y2="8" />
      <line x1="3" y1="16" x2="21" y2="16" />
      <line x1="8" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="16" y2="21" />
    </svg>
  );
}

/** Icon: lined (notebook-style horizontal lines). */
function GridIconLined({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={cn("size-4", className)}
      {...props}
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

/** App menu UI: main menu open, upload-mode dialog, picker anchor. Picker open state is useSingleOpen. */
type AppMenuState = {
  menuOpen: boolean;
  showUploadModeChoice: boolean;
  pickerAnchor: { top: number; centerX: number } | null;
};
type AppMenuAction =
  | { type: "TOGGLE_MENU" }
  | { type: "CLOSE_MENU" }
  | { type: "SHOW_UPLOAD_MODE_CHOICE" }
  | { type: "HIDE_UPLOAD_MODE_CHOICE" }
  | { type: "SET_PICKER_ANCHOR"; payload: { top: number; centerX: number } | null };

function appMenuReducer(state: AppMenuState, action: AppMenuAction): AppMenuState {
  switch (action.type) {
    case "TOGGLE_MENU":
      return { ...state, menuOpen: !state.menuOpen };
    case "CLOSE_MENU":
      return { ...state, menuOpen: false };
    case "SHOW_UPLOAD_MODE_CHOICE":
      return { ...state, showUploadModeChoice: true };
    case "HIDE_UPLOAD_MODE_CHOICE":
      return { ...state, showUploadModeChoice: false };
    case "SET_PICKER_ANCHOR":
      return { ...state, pickerAnchor: action.payload };
    default:
      return state;
  }
}

const INITIAL_APP_MENU_STATE: AppMenuState = {
  menuOpen: false,
  showUploadModeChoice: false,
  pickerAnchor: null,
};

export interface AppMenuProps {
  onUpload: (
    state: WhiteboardState,
    options?: { mode?: "replace" | "append" }
  ) => void;
  onDownload: () => WhiteboardState;
  /** Current whiteboard name, used for the download filename. */
  currentBoardName: string;
  /** Current board background color (from board state). */
  boardBackgroundColor: string;
  /** Current board grid style (from board state). */
  boardGridStyle: GridStyle;
  /** Update current board appearance (persisted with board state). */
  onBoardAppearanceChange: (partial: {
    backgroundColor?: string;
    gridStyle?: GridStyle;
  }) => void;
  canvasPreferences: CanvasPreferences;
  onCanvasPreferenceChange: <K extends keyof CanvasPreferences>(
    key: K,
    value: CanvasPreferences[K]
  ) => void;
}

export function AppMenu({
  onUpload,
  onDownload,
  currentBoardName,
  boardBackgroundColor,
  boardGridStyle,
  onBoardAppearanceChange,
  canvasPreferences,
  onCanvasPreferenceChange,
}: AppMenuProps): JSX.Element {
  const [openPicker, pickerActions] = useSingleOpen<"background">(null);
  const [menuState, dispatch] = useReducer(
    appMenuReducer,
    INITIAL_APP_MENU_STATE
  );
  const { menuOpen, showUploadModeChoice, pickerAnchor } = menuState;
  const menuRef = useRef<HTMLDivElement>(null);
  const backgroundTriggerRef = useRef<HTMLDivElement>(null);
  const backgroundPopupRef = useRef<HTMLDivElement>(null);
  const pendingFileRef = useRef<File | null>(null);

  const PICKER_SIZE = 128;
  const PICKER_GAP = 8;

  // Close menu and picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) === true) return;
      if (backgroundPopupRef.current?.contains(target) === true) return;
      dispatch({ type: "CLOSE_MENU" });
      pickerActions.close();
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [menuOpen, pickerActions]);

  // Position background color picker popover when open (anchor from trigger or center screen)
  useLayoutEffect(() => {
    if (openPicker !== "background") {
      dispatch({ type: "SET_PICKER_ANCHOR", payload: null });
      return;
    }
    const el = backgroundTriggerRef.current;
    if (el == null) {
      dispatch({
        type: "SET_PICKER_ANCHOR",
        payload: {
          top: Math.max(0, (window.innerHeight - PICKER_SIZE) / 2),
          centerX: window.innerWidth / 2,
        },
      });
      return;
    }
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const top = Math.max(
      PICKER_GAP,
      Math.min(
        rect.bottom + 8,
        window.innerHeight - PICKER_SIZE - PICKER_GAP
      )
    );
    dispatch({
      type: "SET_PICKER_ANCHOR",
      payload: {
        top,
        centerX: Math.max(
          PICKER_SIZE / 2 + PICKER_GAP,
          Math.min(centerX, window.innerWidth - PICKER_SIZE / 2 - PICKER_GAP)
        ),
      },
    });
  }, [openPicker]);

  // Close picker on outside click or Escape when background picker is open
  useEffect(() => {
    const handleClickOutsidePicker = (e: MouseEvent): void => {
      if (openPicker !== "background") return;
      const target = e.target as Node;
      if (
        backgroundPopupRef.current?.contains(target) === true ||
        backgroundTriggerRef.current?.contains(target) === true
      ) {
        return;
      }
      pickerActions.close();
    };
    const handleEscapePicker = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && openPicker === "background") {
        pickerActions.close();
      }
    };
    if (openPicker === "background") {
      document.addEventListener("mousedown", handleClickOutsidePicker);
      document.addEventListener("keydown", handleEscapePicker);
      return () => {
        document.removeEventListener("mousedown", handleClickOutsidePicker);
        document.removeEventListener("keydown", handleEscapePicker);
      };
    }
  }, [openPicker, pickerActions]);

  // Escape closes upload mode choice dialog and clears pending file
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      if (showUploadModeChoice) {
        dispatch({ type: "HIDE_UPLOAD_MODE_CHOICE" });
        pendingFileRef.current = null;
      }
    };

    if (showUploadModeChoice) {
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [showUploadModeChoice]);

  const handleDownload = (): void => {
    try {
      const state = onDownload();
      const json = JSON.stringify(state, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const sanitizedName =
        currentBoardName.replace(/[^a-z0-9]/gi, "-") || "whiteboard";
      a.download = `${sanitizedName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      dispatch({ type: "CLOSE_MENU" });
      pickerActions.close();
    } catch (err) {
      console.error("[AppMenu] Download failed", err);
    }
  };

  const openFileInput = (): void => {
    dispatch({ type: "CLOSE_MENU" });
    pickerActions.close();
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file == null) return;
      pendingFileRef.current = file;
      dispatch({ type: "SHOW_UPLOAD_MODE_CHOICE" });
    };
    input.click();
  };

  const readAndApplyFile = (
    file: File,
    mode: "append" | "replace"
  ): void => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as unknown;
        if (
          parsed != null &&
          typeof parsed === "object" &&
          Array.isArray((parsed as WhiteboardState).elements)
        ) {
          const state = parsed as WhiteboardState;
          if (state.panZoom != null) {
            const pz = state.panZoom;
            if (
              typeof pz.panX !== "number" ||
              typeof pz.panY !== "number" ||
              typeof pz.zoom !== "number" ||
              !Number.isFinite(pz.panX) ||
              !Number.isFinite(pz.panY) ||
              !Number.isFinite(pz.zoom) ||
              pz.zoom <= 0
            ) {
              state.panZoom = undefined;
            }
          }
          onUpload(state, { mode });
          if (mode === "replace") {
            pendingFileRef.current = null;
          }
        } else {
          console.error("[AppMenu] Invalid file format");
          if (mode === "replace") {
            pendingFileRef.current = null;
          }
        }
      } catch (err) {
        console.error("[AppMenu] Upload failed", err);
        if (mode === "replace") {
          pendingFileRef.current = null;
        }
      }
    };
    reader.onerror = () => {
      console.error("[AppMenu] File read failed", reader.error);
      if (mode === "replace") {
        pendingFileRef.current = null;
      }
    };
    reader.readAsText(file);
  };

  const handleUploadModeAppend = (): void => {
    const file = pendingFileRef.current;
    if (file == null) {
      dispatch({ type: "HIDE_UPLOAD_MODE_CHOICE" });
      return;
    }
    dispatch({ type: "HIDE_UPLOAD_MODE_CHOICE" });
    pendingFileRef.current = null;
    readAndApplyFile(file, "append");
  };

  const handleUploadModeReplace = (): void => {
    const file = pendingFileRef.current;
    if (file == null) {
      dispatch({ type: "HIDE_UPLOAD_MODE_CHOICE" });
      return;
    }
    dispatch({ type: "HIDE_UPLOAD_MODE_CHOICE" });
    pendingFileRef.current = null;
    readAndApplyFile(file, "replace");
  };

  const handleUploadModeChoiceCancel = (): void => {
    dispatch({ type: "HIDE_UPLOAD_MODE_CHOICE" });
    pendingFileRef.current = null;
  };

  const handleThemeToggle = (): void => {
    const next: Theme = canvasPreferences.theme === "dark" ? "light" : "dark";
    onCanvasPreferenceChange("theme", next);
  };

  const handleGridStyleSelect = (style: GridStyle): void => {
    onBoardAppearanceChange({ gridStyle: style });
  };

  const backgroundHex =
    boardBackgroundColor.startsWith("#") ? boardBackgroundColor : "#ffffff";

  return (
    <div ref={menuRef} className="relative flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="app-menu-button size-[50px] rounded-lg font-semibold shadow-none"
        aria-label="Menu"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => dispatch({ type: "TOGGLE_MENU" })}
        data-state={menuOpen ? "active" : undefined}
      >
        <Menu aria-hidden className="size-5" />
      </Button>
      {menuOpen && (
        <div
          className="app-menu-dropdown absolute right-0 top-full z-[60] mt-1 flex flex-col gap-0.5 rounded-md border border-border bg-popover px-1 py-1 shadow-md min-w-[200px] max-h-[min(80vh,400px)] overflow-y-auto text-foreground"
          role="menu"
          aria-label="App menu"
        >
          <div className="px-2 py-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              App
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full justify-start gap-2 px-3 text-sm"
            onClick={handleThemeToggle}
            role="menuitem"
            aria-label={
              canvasPreferences.theme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
          >
            {canvasPreferences.theme === "dark" ? (
              <Sun aria-hidden className="size-4" />
            ) : (
              <Moon aria-hidden className="size-4" />
            )}
            <span>
              {canvasPreferences.theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </Button>
          <div className="my-1 border-t border-border" role="separator" />
          <div className="px-2 py-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Whiteboard
            </span>
          </div>
          <div ref={backgroundTriggerRef} className="relative">
            <Button
              type="button"
              variant="ghost"
              className="h-9 w-full justify-start gap-2 px-3 text-sm"
              onClick={() => pickerActions.toggle("background")}
              role="menuitem"
              aria-label="Background color"
              aria-expanded={openPicker === "background"}
            >
              <Palette aria-hidden className="size-4" />
              <span>Background color</span>
              <span
                className="ml-auto size-4 rounded border border-border shrink-0"
                style={{ backgroundColor: backgroundHex }}
                aria-hidden
              />
            </Button>
          </div>
          <div className="px-2 py-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1.5">
              Grid
            </span>
            <div
              className="grid-style-selector flex w-full items-center gap-1 rounded-md p-0.5"
              role="group"
              aria-label="Grid style"
            >
              {(["empty", "dotted", "grid-lined", "lined"] as const).map(
                (style) => (
                  <Button
                    key={style}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "grid-style-btn h-8 min-w-0 flex-1 rounded text-foreground",
                      boardGridStyle === style && "grid-style-btn--selected"
                    )}
                    onClick={() => handleGridStyleSelect(style)}
                    role="menuitemradio"
                    aria-label={
                      style === "lined"
                        ? "Lined (notebook)"
                        : style === "grid-lined"
                          ? "Grid lined"
                          : `Grid ${style}`
                    }
                    aria-checked={boardGridStyle === style}
                    title={
                      style === "empty"
                        ? "No grid"
                        : style === "dotted"
                          ? "Dotted grid"
                          : style === "lined"
                            ? "Lined (notebook)"
                            : "Grid lined"
                    }
                  >
                    {style === "empty" ? (
                      <GridIconEmpty aria-hidden className="size-4" />
                    ) : style === "dotted" ? (
                      <GridIconDotted aria-hidden className="size-4" />
                    ) : style === "lined" ? (
                      <GridIconLined aria-hidden className="size-4" />
                    ) : (
                      <GridIconGridLined aria-hidden className="size-4" />
                    )}
                  </Button>
                )
              )}
            </div>
          </div>
          <div className="my-1 border-t border-border" role="separator" />
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full justify-start gap-2 px-3 text-sm"
            onClick={openFileInput}
            role="menuitem"
            aria-label="Upload file"
          >
            <Upload aria-hidden className="size-4" />
            <span>Upload</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full justify-start gap-2 px-3 text-sm"
            onClick={handleDownload}
            role="menuitem"
            aria-label="Download file"
          >
            <Download aria-hidden className="size-4" />
            <span>Download</span>
          </Button>
        </div>
      )}
      {pickerAnchor != null &&
        createPortal(
          <div
            ref={backgroundPopupRef}
            className={cn(
              "flex rounded-lg border border-border bg-popover p-2 shadow-md text-popover-foreground",
              canvasPreferences.theme === "dark" && "dark"
            )}
            style={{
              position: "fixed",
              top: pickerAnchor.top,
              left: pickerAnchor.centerX,
              transform: "translate(-50%, 0)",
              zIndex: 115,
            }}
            role="dialog"
            aria-label="Pick background color"
          >
            <HexColorPicker
              color={backgroundHex}
              onChange={(hex) =>
                onBoardAppearanceChange({ backgroundColor: hex })
              }
              style={{ width: PICKER_SIZE, height: PICKER_SIZE }}
            />
          </div>,
          document.body
        )}
      <Dialog
        open={showUploadModeChoice}
        onOpenChange={(open) => {
          if (!open) handleUploadModeChoiceCancel();
        }}
      >
        <DialogContent
          className={cn(
            "upload-warning-dialog max-w-sm overflow-hidden bg-background text-foreground border-border",
            canvasPreferences.theme === "dark" && "dark"
          )}
        >
          <DialogHeader>
            <DialogTitle className="upload-warning-dialog__title text-foreground">
              Add content from file
            </DialogTitle>
            <DialogDescription>
              Append to the current whiteboard or replace its content?
              <br />
              Both can be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="min-w-0 flex flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              type="button"
              variant="default"
              className="min-w-0 shrink-0 w-full"
              onClick={handleUploadModeAppend}
            >
              Append content
            </Button>
            <Button
              type="button"
              variant="outline"
              className="upload-warning-dialog__replace min-w-0 shrink-0 w-full"
              onClick={handleUploadModeReplace}
            >
              Replace content
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="upload-warning-dialog__cancel min-w-0 shrink-0 w-full"
              onClick={handleUploadModeChoiceCancel}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
