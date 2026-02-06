import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";
import { HexColorPicker } from "react-colorful";

export interface ToolbarColorPickerProps {
  colorPickerOpen: boolean;
  pickerColor: string;
  onPickerColorChange: (hex: string) => void;
  onColorPickerToggle: () => void;
  colorPickerMenuRef: React.RefObject<HTMLDivElement>;
}

export function ToolbarColorPicker({
  colorPickerOpen,
  pickerColor,
  onPickerColorChange,
  onColorPickerToggle,
  colorPickerMenuRef,
}: ToolbarColorPickerProps): JSX.Element {
  return (
    <div ref={colorPickerMenuRef} className="relative flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded [&_svg]:size-3.5"
        aria-label="Text color"
        aria-expanded={colorPickerOpen}
        aria-haspopup="dialog"
        onClick={onColorPickerToggle}
      >
        <Palette aria-hidden />
      </Button>
      {colorPickerOpen && (
        <div
          className="absolute left-1/2 top-full z-[60] mt-2 flex -translate-x-1/2 rounded-lg border border-border bg-popover p-2 shadow-md"
          role="dialog"
          aria-label="Pick text color"
        >
          <HexColorPicker
            color={pickerColor}
            onChange={onPickerColorChange}
            style={{ width: 128, height: 128 }}
          />
        </div>
      )}
    </div>
  );
}
