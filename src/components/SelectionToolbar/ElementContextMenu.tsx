import { Button } from "@/components/ui/button";
import {
  Copy,
  Scissors,
  Files,
  Trash2,
  ArrowDownToLine,
  ArrowUpToLine,
} from "lucide-react";

export interface ElementContextMenuProps {
  onCut: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSendToBack?: () => void;
  onSendToFront?: () => void;
  position: { x: number; y: number } | null;
  onClose: () => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

const MENU_BUTTON_CLASS =
  "h-7 justify-start gap-2 px-2 text-sm [&_svg]:size-3.5";

export function ElementContextMenu({
  onCut,
  onCopy,
  onDuplicate,
  onDelete,
  onSendToBack,
  onSendToFront,
  position,
  onClose,
  menuRef,
}: ElementContextMenuProps): JSX.Element | null {
  if (position == null) return null;

  const run = (fn: () => void): void => {
    fn();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="selection-toolbar fixed z-[100] flex flex-col gap-0.5 rounded-md border border-border bg-popover px-1 py-1 shadow-md"
      style={{
        left: position.x,
        top: position.y,
      }}
      role="menu"
      aria-label="Element actions"
    >
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
      {(onSendToBack != null || onSendToFront != null) && (
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
        </>
      )}
      <div className="my-0.5 h-px bg-border" role="separator" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`destructive-menu-item ${MENU_BUTTON_CLASS}`}
        onClick={() => run(onDelete)}
        role="menuitem"
        aria-label="Delete"
      >
        <Trash2 aria-hidden />
        <span>Delete</span>
      </Button>
    </div>
  );
}
