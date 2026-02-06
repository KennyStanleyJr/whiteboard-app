import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { AlignMenus } from "./AlignMenus";

function createRef(): React.RefObject<HTMLDivElement> {
  return { current: document.createElement("div") };
}

describe("AlignMenus", () => {
  const defaultProps = {
    displayTextAlign: "left" as const,
    displayVerticalAlign: "top" as const,
    onTextAlign: vi.fn(),
    onVerticalAlign: vi.fn(),
    alignMenuOpen: false,
    verticalAlignMenuOpen: false,
    setAlignMenuOpen: vi.fn(),
    setVerticalAlignMenuOpen: vi.fn(),
    alignMenuRef: createRef(),
    verticalAlignMenuRef: createRef(),
  };

  it("renders text alignment and vertical alignment buttons", () => {
    render(<AlignMenus {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /text alignment/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /vertical alignment/i })
    ).toBeInTheDocument();
  });

  it("toggles text align menu when text alignment button is clicked", () => {
    const setAlignMenuOpen = vi.fn();
    render(
      <AlignMenus
        {...defaultProps}
        setAlignMenuOpen={setAlignMenuOpen}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /text alignment/i }));
    expect(setAlignMenuOpen).toHaveBeenCalledWith(expect.any(Function));
  });

  it("shows alignment options when alignMenuOpen is true", () => {
    render(<AlignMenus {...defaultProps} alignMenuOpen />);
    expect(
      screen.getByRole("menu", { name: /alignment options/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /align left/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /align center/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /align right/i })).toBeInTheDocument();
  });

  it("calls onTextAlign and closes menu when align center is clicked", () => {
    const onTextAlign = vi.fn();
    const setAlignMenuOpen = vi.fn();
    render(
      <AlignMenus
        {...defaultProps}
        alignMenuOpen
        onTextAlign={onTextAlign}
        setAlignMenuOpen={setAlignMenuOpen}
      />
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /align center/i }));
    expect(onTextAlign).toHaveBeenCalledWith("center");
    expect(setAlignMenuOpen).toHaveBeenCalledWith(false);
  });

  it("shows vertical alignment options when verticalAlignMenuOpen is true", () => {
    render(<AlignMenus {...defaultProps} verticalAlignMenuOpen />);
    expect(
      screen.getByRole("menu", { name: /vertical alignment options/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /align top/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /align middle/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /align bottom/i })).toBeInTheDocument();
  });

  it("calls onVerticalAlign and closes menu when align middle is clicked", () => {
    const onVerticalAlign = vi.fn();
    const setVerticalAlignMenuOpen = vi.fn();
    render(
      <AlignMenus
        {...defaultProps}
        verticalAlignMenuOpen
        onVerticalAlign={onVerticalAlign}
        setVerticalAlignMenuOpen={setVerticalAlignMenuOpen}
      />
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /align middle/i }));
    expect(onVerticalAlign).toHaveBeenCalledWith("middle");
    expect(setVerticalAlignMenuOpen).toHaveBeenCalledWith(false);
  });
});
