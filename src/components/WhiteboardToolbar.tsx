import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Circle,
  ImageIcon,
  Plus,
  Square,
  TypeIcon,
  Undo2,
  Redo2,
} from "lucide-react";

export interface WhiteboardToolbarProps {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAddText: () => void;
  onAddRectangle: () => void;
  onAddEllipse: () => void;
  onAddImage: () => void;
}

const BUTTON_CLASS = "rounded-md";
const TOOLBAR_CLASS =
  "whiteboard-toolbar fixed left-5 top-[5rem] z-10 flex flex-col items-center gap-1 rounded-lg border p-1.5 shadow-sm";

export function WhiteboardToolbar({
  undo,
  redo,
  canUndo,
  canRedo,
  onAddText,
  onAddRectangle,
  onAddEllipse,
  onAddImage,
}: WhiteboardToolbarProps): JSX.Element {
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const closeAnd = (fn: () => void) => (): void => {
    setAddMenuOpen(false);
    fn();
  };

  return (
    <div className={TOOLBAR_CLASS}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={BUTTON_CLASS}
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="size-5" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={BUTTON_CLASS}
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo (Ctrl+Y)"
      >
        <Redo2 className="size-5" aria-hidden />
      </Button>
      <div className="h-px w-8 bg-border my-0.5" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={BUTTON_CLASS}
        onClick={() => setAddMenuOpen((open) => !open)}
        aria-label="Add element"
        aria-expanded={addMenuOpen}
        aria-haspopup="true"
        title="Add element"
      >
        <Plus
          className={cn(
            "size-5 transition-transform duration-200",
            addMenuOpen && "rotate-45"
          )}
          aria-hidden
        />
      </Button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          addMenuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className="flex flex-col items-center gap-1 pt-0.5"
            role="menu"
            aria-label="Element options"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={BUTTON_CLASS}
              onClick={closeAnd(onAddText)}
              aria-label="Add text"
              role="menuitem"
            >
              <TypeIcon className="size-5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={BUTTON_CLASS}
              onClick={closeAnd(onAddRectangle)}
              aria-label="Add rectangle"
              role="menuitem"
            >
              <Square className="size-5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={BUTTON_CLASS}
              onClick={closeAnd(onAddEllipse)}
              aria-label="Add ellipse"
              role="menuitem"
            >
              <Circle className="size-5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={BUTTON_CLASS}
              onClick={closeAnd(onAddImage)}
              aria-label="Add image"
              role="menuitem"
            >
              <ImageIcon className="size-5" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
