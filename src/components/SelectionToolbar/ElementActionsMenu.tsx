import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Copy, Scissors, Files, Trash2, MoreVertical, ArrowDownToLine, ArrowUpToLine } from "lucide-react";

export interface ElementActionsMenuProps {
  onCut: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSendToBack?: () => void;
  onSendToFront?: () => void;
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
          className="absolute left-1/2 top-full z-[60] mt-1 flex -translate-x-1/2 flex-col gap-0.5 rounded-md border border-border bg-popover px-1 py-1 shadow-md"
          role="menu"
          aria-label="Element actions"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 justify-start gap-2 px-2 text-sm [&_svg]:size-3.5"
            onClick={() => {
              onCut();
              setMenuOpen(false);
            }}
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
            className="h-7 justify-start gap-2 px-2 text-sm [&_svg]:size-3.5"
            onClick={() => {
              onCopy();
              setMenuOpen(false);
            }}
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
            className="h-7 justify-start gap-2 px-2 text-sm [&_svg]:size-3.5"
            onClick={() => {
              onDuplicate();
              setMenuOpen(false);
            }}
            role="menuitem"
            aria-label="Duplicate"
          >
            <Files aria-hidden />
            <span>Duplicate</span>
          </Button>
          {(onSendToBack != null || onSendToFront != null) && (
            <>
              <div className="my-0.5 h-px bg-border" role="separator" />
              {onSendToFront != null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 justify-start gap-2 px-2 text-sm [&_svg]:size-3.5"
                  onClick={() => {
                    onSendToFront();
                    setMenuOpen(false);
                  }}
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
                  className="h-7 justify-start gap-2 px-2 text-sm [&_svg]:size-3.5"
                  onClick={() => {
                    onSendToBack();
                    setMenuOpen(false);
                  }}
                  role="menuitem"
                  aria-label="Send to back"
                >
                  <ArrowDownToLine aria-hidden />
                  <span>Send to Back</span>
                </Button>
              )}
            </>
          )}
          <div className="my-0.5 h-px bg-border" role="separator" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="destructive-menu-item h-7 justify-start gap-2 px-2 text-sm [&_svg]:size-3.5"
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
            role="menuitem"
            aria-label="Delete"
          >
            <Trash2 aria-hidden />
            <span>Delete</span>
          </Button>
        </div>
      )}
    </div>
  );
}
