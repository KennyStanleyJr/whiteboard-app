import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { ImageInfoDialog } from "./ImageInfoDialog";
import type { ImageElement } from "@/types/whiteboard";

const imageElement: ImageElement = {
  id: "img-1",
  x: 10,
  y: 20,
  kind: "image",
  src: "data:image/png;base64,abcd1234",
  width: 400,
  height: 300,
  naturalWidth: 800,
  naturalHeight: 600,
  imageFill: false,
  imageCornerRadius: "small",
};

describe("ImageInfoDialog", () => {
  it("returns null when image is null", () => {
    const { container } = render(
      <ImageInfoDialog image={null} open={false} onOpenChange={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows image info when image is provided and open", () => {
    render(
      <ImageInfoDialog
        image={imageElement}
        open
        onOpenChange={() => {}}
      />
    );
    expect(screen.getByRole("dialog", { name: /image info/i })).toBeInTheDocument();
    expect(screen.getByText("400.00 × 300.00 px")).toBeInTheDocument();
    expect(screen.getByText("800.00 × 600.00 px")).toBeInTheDocument();
    expect(screen.getByText("image/png")).toBeInTheDocument();
    expect(screen.getByText("Data size")).toBeInTheDocument();
  });

  it("applies dark class to dialog content when theme is dark", () => {
    render(
      <ThemeProvider theme="dark">
        <ImageInfoDialog
          image={imageElement}
          open
          onOpenChange={() => {}}
        />
      </ThemeProvider>
    );
    const dialog = screen.getByRole("dialog", { name: /image info/i });
    expect(dialog).toHaveClass("dark");
  });

  it("does not apply dark class when theme is light", () => {
    render(
      <ThemeProvider theme="light">
        <ImageInfoDialog
          image={imageElement}
          open
          onOpenChange={() => {}}
        />
      </ThemeProvider>
    );
    const dialog = screen.getByRole("dialog", { name: /image info/i });
    expect(dialog).not.toHaveClass("dark");
  });

  it("shows Optimize image button when onOptimizeImage provided", () => {
    render(
      <ImageInfoDialog
        image={imageElement}
        open
        onOpenChange={() => {}}
        onOptimizeImage={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: /optimize image/i })
    ).toBeInTheDocument();
  });

  it("does not show Optimize image button when onOptimizeImage not provided", () => {
    render(
      <ImageInfoDialog
        image={imageElement}
        open
        onOpenChange={() => {}}
      />
    );
    expect(
      screen.queryByRole("button", { name: /optimize image/i })
    ).not.toBeInTheDocument();
  });

  it("calls onOptimizeImage when Optimize image is clicked", () => {
    const onOptimizeImage = vi.fn();
    render(
      <ImageInfoDialog
        image={imageElement}
        open
        onOpenChange={() => {}}
        onOptimizeImage={onOptimizeImage}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /optimize image/i })
    );
    expect(onOptimizeImage).toHaveBeenCalledTimes(1);
  });
});
