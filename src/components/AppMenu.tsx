import { useRef, useState, useEffect } from "react";
import { Menu, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WhiteboardState } from "@/api/whiteboard";

export interface AppMenuProps {
  onImport: (state: WhiteboardState) => void;
  onDownload: () => WhiteboardState;
}

export function AppMenu({ onImport, onDownload }: AppMenuProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showImportWarning, setShowImportWarning] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingFileRef = useRef<File | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (
        menuRef.current != null &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [menuOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && showImportWarning) {
        setShowImportWarning(false);
        pendingFileRef.current = null;
      }
    };

    if (showImportWarning) {
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [showImportWarning]);

  const handleDownload = (): void => {
    try {
      const state = onDownload();
      const json = JSON.stringify(state, null, 2);
      const blob = new Blob([json], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Generate readable filename: whiteboard-YYYY-MM-DD-HH-MM-SS.txt
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const filename = `whiteboard-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.txt`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMenuOpen(false);
    } catch (err) {
      console.error("[AppMenu] Download failed", err);
    }
  };

  const handleImportClick = (): void => {
    setMenuOpen(false);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file == null) return;
      pendingFileRef.current = file;
      setShowImportWarning(true);
    };
    input.click();
  };

  const handleImportConfirm = (): void => {
    const file = pendingFileRef.current;
    if (file == null) {
      setShowImportWarning(false);
      pendingFileRef.current = null;
      return;
    }
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
          // Validate panZoom if present
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
              // Invalid panZoom, remove it
              state.panZoom = undefined;
            }
          }
          onImport(state);
          setShowImportWarning(false);
          pendingFileRef.current = null;
        } else {
          console.error("[AppMenu] Invalid file format");
          setShowImportWarning(false);
          pendingFileRef.current = null;
        }
      } catch (err) {
        console.error("[AppMenu] Import failed", err);
        setShowImportWarning(false);
        pendingFileRef.current = null;
      }
    };
    reader.onerror = () => {
      console.error("[AppMenu] File read failed", reader.error);
      setShowImportWarning(false);
      pendingFileRef.current = null;
    };
    reader.readAsText(file);
  };

  const handleImportCancel = (): void => {
    setShowImportWarning(false);
    pendingFileRef.current = null;
  };

  return (
    <div ref={menuRef} className="relative flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="app-menu-button size-[50px] rounded-lg border border-border font-semibold text-foreground shadow-none"
        aria-label="Menu"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((open) => !open)}
        data-state={menuOpen ? "active" : undefined}
      >
        <Menu aria-hidden className="size-5" />
      </Button>
      {menuOpen && (
        <div
          className="absolute right-0 top-full z-[60] mt-1 flex flex-col gap-0.5 rounded-md border border-border bg-popover px-1 py-1 shadow-md min-w-[160px]"
          role="menu"
          aria-label="App menu"
        >
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full justify-start gap-2 px-3 text-sm"
            onClick={handleImportClick}
            role="menuitem"
            aria-label="Import file"
          >
            <Upload aria-hidden className="size-4" />
            <span>Import</span>
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
      {showImportWarning && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-warning-title"
          onClick={handleImportCancel}
        >
          <div
            className="relative flex flex-col gap-4 rounded-lg border border-border bg-popover p-6 shadow-lg max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="import-warning-title"
              className="text-lg font-semibold text-foreground"
            >
              Warning
            </h2>
            <p className="text-sm text-muted-foreground">
              Importing a file will replace all existing content on the
              whiteboard. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleImportCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={handleImportConfirm}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
