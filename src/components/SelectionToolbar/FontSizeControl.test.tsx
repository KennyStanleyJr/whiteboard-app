import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { FontSizeControl } from "./FontSizeControl";

describe("FontSizeControl", () => {
  const defaultProps = {
    displayFontSize: 24,
    singleFontSize: true,
    presetValue: "24",
    onFontSizeChange: vi.fn(),
    onInputChange: vi.fn(),
    onInputBlur: vi.fn(),
  };

  it("renders font size input and buttons", () => {
    render(<FontSizeControl {...defaultProps} />);
    expect(screen.getByRole("spinbutton", { name: /font size/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decrease font size/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /increase font size/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /font size presets/i })).toBeInTheDocument();
  });

  it("shows displayFontSize in input when singleFontSize is true", () => {
    render(<FontSizeControl {...defaultProps} displayFontSize={32} />);
    const input = screen.getByRole("spinbutton", { name: /font size/i });
    expect(input).toHaveValue(32);
  });

  it("calls onFontSizeChange with decreased value when decrease is clicked", () => {
    const onFontSizeChange = vi.fn();
    render(
      <FontSizeControl
        {...defaultProps}
        displayFontSize={24}
        onFontSizeChange={onFontSizeChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /decrease font size/i }));
    expect(onFontSizeChange).toHaveBeenCalledWith(23);
  });

  it("calls onFontSizeChange with increased value when increase is clicked", () => {
    const onFontSizeChange = vi.fn();
    render(
      <FontSizeControl
        {...defaultProps}
        displayFontSize={24}
        onFontSizeChange={onFontSizeChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /increase font size/i }));
    expect(onFontSizeChange).toHaveBeenCalledWith(25);
  });

  it("calls onInputChange when input value changes", () => {
    const onInputChange = vi.fn();
    render(<FontSizeControl {...defaultProps} onInputChange={onInputChange} />);
    const input = screen.getByRole("spinbutton", { name: /font size/i });
    fireEvent.change(input, { target: { value: "48" } });
    expect(onInputChange).toHaveBeenCalled();
  });

  it("calls onInputBlur when input loses focus", () => {
    const onInputBlur = vi.fn();
    render(<FontSizeControl {...defaultProps} onInputBlur={onInputBlur} />);
    const input = screen.getByRole("spinbutton", { name: /font size/i });
    fireEvent.blur(input);
    expect(onInputBlur).toHaveBeenCalled();
  });

  it("shows placeholder when singleFontSize is false", () => {
    render(<FontSizeControl {...defaultProps} singleFontSize={false} presetValue="" />);
    const input = screen.getByRole("spinbutton", { name: /font size/i });
    expect(input).toHaveAttribute("placeholder", "—");
  });
});
