import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bold, Italic, Underline } from "lucide-react";

export interface FormatButtonsRowProps {
  displayBold: boolean;
  displayItalic: boolean;
  displayUnderline: boolean;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
}

export function FormatButtonsRow({
  displayBold,
  displayItalic,
  displayUnderline,
  onBold,
  onItalic,
  onUnderline,
}: FormatButtonsRowProps): JSX.Element {
  return (
    <div className="flex items-center gap-0.5 border-r border-border pr-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 rounded [&_svg]:size-3.5",
          displayBold && "bg-accent text-accent-foreground"
        )}
        onClick={onBold}
        aria-label="Bold"
        aria-pressed={displayBold}
      >
        <Bold aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 rounded [&_svg]:size-3.5",
          displayItalic && "bg-accent text-accent-foreground"
        )}
        onClick={onItalic}
        aria-label="Italic"
        aria-pressed={displayItalic}
      >
        <Italic aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-7 w-7 rounded [&_svg]:size-3.5",
          displayUnderline && "bg-accent text-accent-foreground"
        )}
        onClick={onUnderline}
        aria-label="Underline"
        aria-pressed={displayUnderline}
      >
        <Underline aria-hidden />
      </Button>
    </div>
  );
}
