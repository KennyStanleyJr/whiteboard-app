import { Button } from "@/components/ui/button";
import { ClipboardPaste } from "lucide-react";

export interface CanvasContextMenuProps {
  position: { x: number; y: number } | null;
  onClose: () => void;
  onPaste: () => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

export function CanvasContextMenu({
  position,
  onClose,
  onPaste,
  menuRef,
}: CanvasContextMenuProps): JSX.Element | null {
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
      aria-label="Canvas actions"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 justify-start gap-2 px-2 text-sm [&_svg]:size-3.5"
        onClick={() => {
          onPaste();
          onClose();
        }}
        role="menuitem"
        aria-label="Paste"
      >
        <ClipboardPaste aria-hidden />
        <span>Paste</span>
      </Button>
    </div>
  );
}
