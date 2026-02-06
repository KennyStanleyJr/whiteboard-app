import { Button } from "@/components/ui/button";
import { Copy, Scissors, Files, Trash2 } from "lucide-react";

export interface ElementContextMenuProps {
  onCut: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  position: { x: number; y: number } | null;
  onClose: () => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

export function ElementContextMenu({
  onCut,
  onCopy,
  onDuplicate,
  onDelete,
  position,
  onClose,
  menuRef,
}: ElementContextMenuProps): JSX.Element | null {
  if (position == null) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] flex flex-col gap-0.5 rounded-md border border-border bg-popover px-1 py-1 shadow-md"
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
        className="h-7 justify-start gap-2 px-2 text-sm [&_svg]:size-3.5"
        onClick={() => {
          onCut();
          onClose();
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
          onClose();
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
          onClose();
        }}
        role="menuitem"
        aria-label="Duplicate"
      >
        <Files aria-hidden />
        <span>Duplicate</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 justify-start gap-2 px-2 text-sm text-destructive hover:text-destructive [&_svg]:size-3.5"
        onClick={() => {
          onDelete();
          onClose();
        }}
        role="menuitem"
        aria-label="Delete"
      >
        <Trash2 aria-hidden />
        <span>Delete</span>
      </Button>
    </div>
  );
}
