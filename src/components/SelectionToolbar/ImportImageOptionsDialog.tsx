import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/contexts/themeContext";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ImportImageOptionsItem {
  file: File;
  worldX: number;
  worldY: number;
}

export interface ImportImageOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pending image(s) to add; when non-empty, dialog is shown. */
  items: ImportImageOptionsItem[];
  onKeepOriginal: () => void;
  onOptimize: () => void;
  isOptimizing?: boolean;
}

export function ImportImageOptionsDialog({
  open,
  onOpenChange,
  items,
  onKeepOriginal,
  onOptimize,
  isOptimizing = false,
}: ImportImageOptionsDialogProps): JSX.Element {
  const theme = useTheme();
  const count = items.length;
  const title = count === 1 ? "Add image" : `Add ${count} images`;
  const noun = count === 1 ? "image" : "images";
  const pronoun = count === 1 ? "it" : "them";
  const description = `Optimize the ${noun} to reduce file size or keep ${pronoun} at full size.`;

  const handleKeepOriginal = (): void => {
    onKeepOriginal();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "import-image-options-dialog max-w-sm overflow-hidden bg-background text-foreground border-border",
          theme === "dark" && "dark"
        )}
      >
        <DialogHeader>
          <DialogTitle className="import-image-options-dialog__title text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="min-w-0 flex flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            variant="default"
            className="min-w-0 shrink-0 w-full"
            onClick={onOptimize}
            disabled={isOptimizing}
          >
            {isOptimizing ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Optimizing…
              </>
            ) : (
              "Optimize (recommended)"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-w-0 shrink-0 w-full"
            onClick={handleKeepOriginal}
            disabled={isOptimizing}
          >
            Keep original size
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
