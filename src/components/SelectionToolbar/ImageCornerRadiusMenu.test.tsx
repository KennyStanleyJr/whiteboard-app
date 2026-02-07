import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { ImageCornerRadiusMenu } from "./ImageCornerRadiusMenu";

function createRef(): React.RefObject<HTMLDivElement> {
  return { current: null };
}

describe("ImageCornerRadiusMenu", () => {
  const defaultProps = {
    displayCornerRadius: "none" as const,
    onCornerRadiusChange: vi.fn(),
    menuOpen: false,
    setMenuOpen: vi.fn(),
    menuRef: createRef(),
  };

  it("renders corner radius trigger button", () => {
    render(<ImageCornerRadiusMenu {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /corner radius/i })
    ).toBeInTheDocument();
  });

  it("does not show menu when menuOpen is false", () => {
    render(<ImageCornerRadiusMenu {...defaultProps} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows menu with options when menuOpen is true", () => {
    render(<ImageCornerRadiusMenu {...defaultProps} menuOpen />);
    expect(
      screen.getByRole("menu", { name: /corner radius options/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /no rounded corners/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /small rounded corners/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /large rounded corners/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /rounded full/i })
    ).toBeInTheDocument();
  });

  it("toggles menu when trigger is clicked", () => {
    const setMenuOpen = vi.fn();
    render(
      <ImageCornerRadiusMenu {...defaultProps} setMenuOpen={setMenuOpen} />
    );
    fireEvent.click(screen.getByRole("button", { name: /corner radius/i }));
    expect(setMenuOpen).toHaveBeenCalledWith(expect.any(Function));
  });

  it("calls onCornerRadiusChange and setMenuOpen(false) when option clicked", () => {
    const onCornerRadiusChange = vi.fn();
    const setMenuOpen = vi.fn();
    render(
      <ImageCornerRadiusMenu
        {...defaultProps}
        menuOpen
        onCornerRadiusChange={onCornerRadiusChange}
        setMenuOpen={setMenuOpen}
      />
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: /small rounded corners/i })
    );
    expect(onCornerRadiusChange).toHaveBeenCalledWith("small");
    expect(setMenuOpen).toHaveBeenCalledWith(false);
  });
});
