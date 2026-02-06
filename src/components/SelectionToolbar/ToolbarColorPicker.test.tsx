import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { ToolbarColorPicker } from "./ToolbarColorPicker";

describe("ToolbarColorPicker", () => {
  const defaultProps = {
    colorPickerOpen: false,
    pickerColor: "#000000",
    onPickerColorChange: vi.fn(),
    onColorPickerToggle: vi.fn(),
    colorPickerMenuRef: { current: null } as React.RefObject<HTMLDivElement>,
  };

  it("renders text color button", () => {
    render(<ToolbarColorPicker {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /text color/i })
    ).toBeInTheDocument();
  });

  it("calls onColorPickerToggle when button is clicked", () => {
    const onColorPickerToggle = vi.fn();
    render(
      <ToolbarColorPicker
        {...defaultProps}
        onColorPickerToggle={onColorPickerToggle}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /text color/i }));
    expect(onColorPickerToggle).toHaveBeenCalledTimes(1);
  });

  it("has aria-expanded false when closed", () => {
    render(<ToolbarColorPicker {...defaultProps} colorPickerOpen={false} />);
    expect(screen.getByRole("button", { name: /text color/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("has aria-expanded true when open", () => {
    render(<ToolbarColorPicker {...defaultProps} colorPickerOpen />);
    expect(screen.getByRole("button", { name: /text color/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("shows color picker dialog when colorPickerOpen is true", () => {
    render(<ToolbarColorPicker {...defaultProps} colorPickerOpen />);
    expect(
      screen.getByRole("dialog", { name: /pick text color/i })
    ).toBeInTheDocument();
  });

  it("does not show dialog when colorPickerOpen is false", () => {
    render(<ToolbarColorPicker {...defaultProps} colorPickerOpen={false} />);
    expect(
      screen.queryByRole("dialog", { name: /pick text color/i })
    ).not.toBeInTheDocument();
  });
});
