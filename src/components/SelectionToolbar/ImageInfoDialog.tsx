import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/contexts/themeContext";
import { cn } from "@/lib/utils";
import type { ImageElement } from "@/types/whiteboard";

export interface ImageInfoDialogProps {
  image: ImageElement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, shows an "Optimize image" button that calls this when clicked. */
  onOptimizeImage?: () => void;
  /** When true, disables the optimize button (e.g. while optimization is in progress). */
  isOptimizing?: boolean;
}

/** Approximate byte size from a data URL base64 payload. */
function dataUrlApproxBytes(dataUrl: string): number | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const b64Length = dataUrl.length - comma - 1;
  return Math.floor((b64Length * 3) / 4);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** MIME type or label from data URL; null for blob URLs. */
function formatFromDataUrl(src: string): string | null {
  if (!src.startsWith("data:")) return null;
  const match = /^data:(image\/[^;]+)/i.exec(src);
  return match?.[1] ?? null;
}

export function ImageInfoDialog({
  image,
  open,
  onOpenChange,
  onOptimizeImage,
  isOptimizing = false,
}: ImageInfoDialogProps): JSX.Element | null {
  const theme = useTheme();
  if (image == null) return null;

  const displaySize = `${Number(image.width).toFixed(2)} × ${Number(image.height).toFixed(2)} px`;
  const natural =
    image.naturalWidth != null && image.naturalHeight != null
      ? `${Number(image.naturalWidth).toFixed(2)} × ${Number(image.naturalHeight).toFixed(2)} px`
      : null;
  const format = formatFromDataUrl(image.src);
  const approxBytes = image.src.startsWith("data:")
    ? dataUrlApproxBytes(image.src)
    : null;
  const dataSize = approxBytes != null ? formatBytes(approxBytes) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "image-info-dialog max-w-sm overflow-hidden bg-background text-foreground border-border",
          theme === "dark" && "dark"
        )}
      >
        <DialogHeader>
          <DialogTitle className="image-info-dialog__title text-foreground">
            Image info
          </DialogTitle>
          <DialogDescription className="sr-only">
            Display size, natural size, format, and data size for this image.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm text-foreground">
          <dt className="text-muted-foreground">Display size</dt>
          <dd>{displaySize}</dd>
          {natural != null && (
            <>
              <dt className="text-muted-foreground">Natural size</dt>
              <dd>{natural}</dd>
            </>
          )}
          {format != null && (
            <>
              <dt className="text-muted-foreground">Format</dt>
              <dd>{format}</dd>
            </>
          )}
          {dataSize != null && (
            <>
              <dt className="text-muted-foreground">Data size</dt>
              <dd>{dataSize}</dd>
            </>
          )}
        </dl>
        {onOptimizeImage != null && (
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="image-info-dialog__optimize-btn"
              onClick={onOptimizeImage}
              disabled={isOptimizing}
              aria-label="Optimize image"
            >
              {isOptimizing ? "Optimizing…" : "Optimize image"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
