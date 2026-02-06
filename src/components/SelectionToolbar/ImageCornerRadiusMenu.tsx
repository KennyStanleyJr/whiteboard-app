import type { ImageCornerRadius } from "@/types/whiteboard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ImageCornerRadiusMenuProps {
  displayCornerRadius: ImageCornerRadius;
  onCornerRadiusChange: (value: ImageCornerRadius) => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

const ICON_PROPS = {
  viewBox: "0 0 16 16",
  className: "size-3.5",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.5,
  "aria-hidden": true,
};

const CORNER_RADIUS_OPTIONS: { value: ImageCornerRadius; label: string }[] = [
  { value: "none", label: "No rounded corners" },
  { value: "small", label: "Small rounded corners" },
  { value: "large", label: "Large rounded corners" },
  { value: "full", label: "Rounded full" },
];

function IconNone(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <rect x="1" y="1" width="14" height="14" rx="0" ry="0" />
    </svg>
  );
}

function IconSmall(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <rect x="1" y="1" width="14" height="14" rx="2" ry="2" />
    </svg>
  );
}

function IconLarge(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <rect x="1" y="1" width="14" height="14" rx="5" ry="5" />
    </svg>
  );
}

function IconFull(): JSX.Element {
  return (
    <svg {...ICON_PROPS}>
      <rect x="1" y="1" width="14" height="14" rx="7" ry="7" />
    </svg>
  );
}

function CornerIcon({ value }: { value: ImageCornerRadius }): JSX.Element {
  switch (value) {
    case "none":
      return <IconNone />;
    case "small":
      return <IconSmall />;
    case "large":
      return <IconLarge />;
    case "full":
      return <IconFull />;
    default:
      return <IconNone />;
  }
}

export function ImageCornerRadiusMenu({
  displayCornerRadius,
  onCornerRadiusChange,
  menuOpen,
  setMenuOpen,
  menuRef,
}: ImageCornerRadiusMenuProps): JSX.Element {
  return (
    <div ref={menuRef} className="relative flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7 rounded [&_svg]:size-3.5", menuOpen && "bg-accent")}
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Corner radius"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        data-state={menuOpen ? "active" : undefined}
      >
        <CornerIcon value={displayCornerRadius} />
      </Button>
      {menuOpen && (
        <div
          className="absolute left-1/2 top-full z-[60] mt-1 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border bg-popover px-1 py-1 shadow-md"
          role="menu"
          aria-label="Corner radius options"
        >
          {CORNER_RADIUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded [&_svg]:size-3.5"
              onClick={() => {
                onCornerRadiusChange(opt.value);
                setMenuOpen(false);
              }}
              role="menuitem"
              aria-label={opt.label}
              data-state={displayCornerRadius === opt.value ? "active" : undefined}
            >
              <CornerIcon value={opt.value} />
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
