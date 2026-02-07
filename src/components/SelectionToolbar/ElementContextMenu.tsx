import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Copy,
  Scissors,
  Files,
  Trash2,
  ArrowDownToLine,
  ArrowUpToLine,
  Info,
  MoreVertical,
} from "lucide-react";

/** Props shared by the menu item list (used by both context and toolbar). */
interface ElementContextMenuActionsProps {
  onCut: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSendToBack?: () => void;
  onSendToFront?: () => void;
  onGetImageInfo?: () => void;
  onAction: () => void;
}

const MENU_BUTTON_CLASS =
  "h-7 justify-start gap-2 px-2 text-sm [&_svg]:size-3.5";

function ElementContextMenuActions({
  onCut,
  onCopy,
  onDuplicate,
  onDelete,
  onSendToBack,
  onSendToFront,
  onGetImageInfo,
  onAction,
}: ElementContextMenuActionsProps): JSX.Element {
  const run = (fn: () => void): void => {
    fn();
    onAction();
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={MENU_BUTTON_CLASS}
        onClick={() => run(onCut)}
        role="menuitem"
        aria-label="Cut"
      >
        <Scissors aria-hidden />
        <span>Cut</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={MENU_BUTTON_CLASS}
        onClick={() => run(onCopy)}
        role="menuitem"
        aria-label="Copy"
      >
        <Copy aria-hidden />
        <span>Copy</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={MENU_BUTTON_CLASS}
        onClick={() => run(onDuplicate)}
        role="menuitem"
        aria-label="Duplicate"
      >
        <Files aria-hidden />
        <span>Duplicate</span>
      </Button>
      {(onSendToBack != null ||
        onSendToFront != null ||
        onGetImageInfo != null) && (
        <>
          <div className="my-0.5 h-px bg-border" role="separator" />
          {onSendToFront != null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={MENU_BUTTON_CLASS}
              onClick={() => run(onSendToFront)}
              role="menuitem"
              aria-label="Send to front"
            >
              <ArrowUpToLine aria-hidden />
              <span>Send to Front</span>
            </Button>
          )}
          {onSendToBack != null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={MENU_BUTTON_CLASS}
              onClick={() => run(onSendToBack)}
              role="menuitem"
              aria-label="Send to back"
            >
              <ArrowDownToLine aria-hidden />
              <span>Send to Back</span>
            </Button>
          )}
          {onGetImageInfo != null && (
            <>
              {(onSendToFront != null || onSendToBack != null) && (
                <div className="my-0.5 h-px bg-border" role="separator" />
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={MENU_BUTTON_CLASS}
                onClick={() => run(onGetImageInfo)}
                role="menuitem"
                aria-label="Get info"
              >
                <Info aria-hidden />
                <span>Get info</span>
              </Button>
            </>
          )}
        </>
      )}
      <div className="my-0.5 h-px bg-border" role="separator" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("destructive-menu-item", MENU_BUTTON_CLASS)}
        onClick={() => run(onDelete)}
        role="menuitem"
        aria-label="Delete"
      >
        <Trash2 aria-hidden />
        <span>Delete</span>
      </Button>
    </>
  );
}

const MENU_PANEL_CLASS =
  "flex flex-col gap-0.5 rounded-md border border-border bg-popover px-1 py-1 shadow-md";

// --- Context menu (right-click) ---

export interface ElementContextMenuProps {
  onCut: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSendToBack?: () => void;
  onSendToFront?: () => void;
  onGetImageInfo?: () => void;
  position: { x: number; y: number } | null;
  onClose: () => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

export function ElementContextMenu({
  onCut,
  onCopy,
  onDuplicate,
  onDelete,
  onSendToBack,
  onSendToFront,
  onGetImageInfo,
  position,
  onClose,
  menuRef,
}: ElementContextMenuProps): JSX.Element | null {
  if (position == null) return null;

  return (
    <div
      ref={menuRef}
      className={cn("selection-toolbar fixed z-[100]", MENU_PANEL_CLASS)}
      style={{ left: position.x, top: position.y }}
      role="menu"
      aria-label="Element actions"
    >
      <ElementContextMenuActions
        onCut={onCut}
        onCopy={onCopy}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onSendToBack={onSendToBack}
        onSendToFront={onSendToFront}
        onGetImageInfo={onGetImageInfo}
        onAction={onClose}
      />
    </div>
  );
}

// --- Toolbar dropdown ---

export interface ElementActionsMenuProps {
  onCut: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSendToBack?: () => void;
  onSendToFront?: () => void;
  onGetImageInfo?: () => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

export function ElementActionsMenu({
  onCut,
  onCopy,
  onDuplicate,
  onDelete,
  onSendToBack,
  onSendToFront,
  onGetImageInfo,
  menuOpen,
  setMenuOpen,
  menuRef,
}: ElementActionsMenuProps): JSX.Element {
  return (
    <div ref={menuRef} className="relative flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7 rounded [&_svg]:size-3.5", menuOpen && "bg-accent")}
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Element actions"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        data-state={menuOpen ? "active" : undefined}
      >
        <MoreVertical aria-hidden />
      </Button>
      {menuOpen && (
        <div
          className={cn(
            "absolute left-1/2 top-full z-[60] mt-1 -translate-x-1/2",
            MENU_PANEL_CLASS
          )}
          role="menu"
          aria-label="Element actions"
        >
          <ElementContextMenuActions
            onCut={onCut}
            onCopy={onCopy}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onSendToBack={onSendToBack}
            onSendToFront={onSendToFront}
            onGetImageInfo={onGetImageInfo}
            onAction={() => setMenuOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
