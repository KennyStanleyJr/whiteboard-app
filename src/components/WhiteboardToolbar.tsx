import { Button } from "@/components/ui/button";
import { Circle, ImageIcon, Square, TypeIcon, Undo2, Redo2 } from "lucide-react";

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
const TOOLBAR_CONTAINER_CLASS =
  "whiteboard-toolbar fixed left-5 top-[5rem] z-10 flex flex-col items-center gap-1 rounded-lg border border-border bg-background p-1.5 shadow-sm";

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
  return (
    <div className={TOOLBAR_CONTAINER_CLASS}>
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
        onClick={onAddText}
        aria-label="Add text"
      >
        <TypeIcon className="size-5" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={BUTTON_CLASS}
        onClick={onAddRectangle}
        aria-label="Add rectangle"
      >
        <Square className="size-5" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={BUTTON_CLASS}
        onClick={onAddEllipse}
        aria-label="Add ellipse"
      >
        <Circle className="size-5" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={BUTTON_CLASS}
        onClick={onAddImage}
        aria-label="Add image"
      >
        <ImageIcon className="size-5" aria-hidden />
      </Button>
    </div>
  );
}
