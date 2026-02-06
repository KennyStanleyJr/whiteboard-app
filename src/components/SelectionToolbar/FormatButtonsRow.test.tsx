import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { FormatButtonsRow } from "./FormatButtonsRow";

describe("FormatButtonsRow", () => {
  const defaultProps = {
    displayBold: false,
    displayItalic: false,
    displayUnderline: false,
    onBold: vi.fn(),
    onItalic: vi.fn(),
    onUnderline: vi.fn(),
  };

  it("renders Bold, Italic, Underline buttons", () => {
    render(<FormatButtonsRow {...defaultProps} />);
    expect(screen.getByRole("button", { name: /^Bold$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Italic$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Underline$/i })).toBeInTheDocument();
  });

  it("calls onBold when Bold is clicked", () => {
    const onBold = vi.fn();
    render(<FormatButtonsRow {...defaultProps} onBold={onBold} />);
    fireEvent.click(screen.getByRole("button", { name: /^Bold$/i }));
    expect(onBold).toHaveBeenCalledTimes(1);
  });

  it("calls onItalic when Italic is clicked", () => {
    const onItalic = vi.fn();
    render(<FormatButtonsRow {...defaultProps} onItalic={onItalic} />);
    fireEvent.click(screen.getByRole("button", { name: /^Italic$/i }));
    expect(onItalic).toHaveBeenCalledTimes(1);
  });

  it("calls onUnderline when Underline is clicked", () => {
    const onUnderline = vi.fn();
    render(<FormatButtonsRow {...defaultProps} onUnderline={onUnderline} />);
    fireEvent.click(screen.getByRole("button", { name: /^Underline$/i }));
    expect(onUnderline).toHaveBeenCalledTimes(1);
  });

  it("sets aria-pressed on Bold when displayBold is true", () => {
    render(<FormatButtonsRow {...defaultProps} displayBold />);
    expect(screen.getByRole("button", { name: /^Bold$/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("sets aria-pressed on Italic when displayItalic is true", () => {
    render(<FormatButtonsRow {...defaultProps} displayItalic />);
    expect(screen.getByRole("button", { name: /^Italic$/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("sets aria-pressed on Underline when displayUnderline is true", () => {
    render(<FormatButtonsRow {...defaultProps} displayUnderline />);
    expect(screen.getByRole("button", { name: /^Underline$/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
