import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Minus, Plus } from "lucide-react";
import {
  FONT_SIZE_PRESETS,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
} from "./selectionToolbarUtils";

export interface FontSizeControlProps {
  displayFontSize: number;
  singleFontSize: boolean;
  presetValue: string;
  onFontSizeChange: (num: number) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInputBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export function FontSizeControl({
  displayFontSize,
  singleFontSize,
  presetValue,
  onFontSizeChange,
  onInputChange,
  onInputBlur,
}: FontSizeControlProps): JSX.Element {
  return (
    <div className="flex items-center">
      <div className="flex h-7 items-center overflow-hidden rounded-md border border-border bg-muted/30">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-6 min-w-0 shrink-0 rounded-l-md rounded-r-none text-muted-foreground hover:bg-muted/50 [&_svg]:size-3"
          onClick={() => onFontSizeChange(displayFontSize - 1)}
          aria-label="Decrease font size"
        >
          <Minus aria-hidden />
        </Button>
        <Input
          type="number"
          min={MIN_FONT_SIZE}
          max={MAX_FONT_SIZE}
          value={singleFontSize ? displayFontSize : ""}
          placeholder={singleFontSize ? undefined : "—"}
          onChange={onInputChange}
          onBlur={onInputBlur}
          className="h-7 w-9 border-0 bg-transparent px-1 py-0 text-center text-base tabular-nums text-foreground shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          aria-label="Font size"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-6 min-w-0 shrink-0 rounded-none border-r border-border text-muted-foreground hover:bg-muted/50 [&_svg]:size-3"
          onClick={() => onFontSizeChange(displayFontSize + 1)}
          aria-label="Increase font size"
        >
          <Plus aria-hidden />
        </Button>
        <Select
          value={presetValue}
          onValueChange={(v) => {
            const num = Number(v);
            if (FONT_SIZE_PRESETS.includes(num)) onFontSizeChange(num);
          }}
        >
          <SelectTrigger
            className="h-7 w-6 min-h-0 shrink-0 justify-center rounded-r-md rounded-l-none border-0 bg-transparent px-0 shadow-none focus:ring-0 [&_[data-slot=select-value]]:hidden [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:opacity-70"
            aria-label="Font size presets"
          >
            <SelectValue placeholder="…" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            align="center"
            sideOffset={4}
            className="min-w-0 w-14"
          >
            {FONT_SIZE_PRESETS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
