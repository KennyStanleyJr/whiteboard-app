import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import {
  ImportImageOptionsDialog,
  type ImportImageOptionsItem,
} from "./ImportImageOptionsDialog";

function createItem(overrides?: Partial<ImportImageOptionsItem>): ImportImageOptionsItem {
  return {
    file: new File([], "test.png", { type: "image/png" }),
    worldX: 0,
    worldY: 0,
    ...overrides,
  };
}

describe("ImportImageOptionsDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    items: [createItem()],
    onKeepOriginal: vi.fn(),
    onOptimize: vi.fn(),
  };

  it("shows dialog when open with items", () => {
    render(
      <ThemeProvider theme="light">
        <ImportImageOptionsDialog {...defaultProps} />
      </ThemeProvider>
    );
    expect(screen.getByRole("dialog", { name: /add image/i })).toBeInTheDocument();
    expect(
      screen.getByText(/optimize the image to reduce file size or keep it at full size/i)
    ).toBeInTheDocument();
  });

  it("shows singular title and description for one item", () => {
    render(
      <ThemeProvider theme="light">
        <ImportImageOptionsDialog {...defaultProps} items={[createItem()]} />
      </ThemeProvider>
    );
    expect(screen.getByRole("dialog", { name: "Add image" })).toBeInTheDocument();
    expect(
      screen.getByText(/optimize the image to reduce file size or keep it at full size/i)
    ).toBeInTheDocument();
  });

  it("shows plural title and description for multiple items", () => {
    render(
      <ThemeProvider theme="light">
        <ImportImageOptionsDialog
          {...defaultProps}
          items={[createItem(), createItem(), createItem()]}
        />
      </ThemeProvider>
    );
    expect(screen.getByRole("dialog", { name: "Add 3 images" })).toBeInTheDocument();
    expect(
      screen.getByText(/optimize the images to reduce file size or keep them at full size/i)
    ).toBeInTheDocument();
  });

  it("calls onOptimize when Optimize (recommended) is clicked", () => {
    const onOptimize = vi.fn();
    render(
      <ThemeProvider theme="light">
        <ImportImageOptionsDialog {...defaultProps} onOptimize={onOptimize} />
      </ThemeProvider>
    );
    fireEvent.click(
      screen.getByRole("button", { name: /optimize \(recommended\)/i })
    );
    expect(onOptimize).toHaveBeenCalledTimes(1);
  });

  it("calls onKeepOriginal and onOpenChange(false) when Keep original size is clicked", () => {
    const onKeepOriginal = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ThemeProvider theme="light">
        <ImportImageOptionsDialog
          {...defaultProps}
          onKeepOriginal={onKeepOriginal}
          onOpenChange={onOpenChange}
        />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /keep original size/i }));
    expect(onKeepOriginal).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables both action buttons when isOptimizing", () => {
    render(
      <ThemeProvider theme="light">
        <ImportImageOptionsDialog {...defaultProps} isOptimizing />
      </ThemeProvider>
    );
    expect(
      screen.getByRole("button", { name: /optimizing/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /keep original size/i })
    ).toBeDisabled();
  });

  it("applies dark class to dialog when theme is dark", () => {
    render(
      <ThemeProvider theme="dark">
        <ImportImageOptionsDialog {...defaultProps} />
      </ThemeProvider>
    );
    const dialog = screen.getByRole("dialog", { name: /add image/i });
    expect(dialog).toHaveClass("dark");
  });
});
