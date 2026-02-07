import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { ElementActionsMenu } from "./ElementActionsMenu";

function createRef(): React.RefObject<HTMLDivElement> {
  return { current: null };
}

describe("ElementActionsMenu", () => {
  const defaultProps = {
    onCut: vi.fn(),
    onCopy: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    menuOpen: false,
    setMenuOpen: vi.fn(),
    menuRef: createRef(),
  };

  it("renders element actions trigger button", () => {
    render(<ElementActionsMenu {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /element actions/i })
    ).toBeInTheDocument();
  });

  it("does not show menu when menuOpen is false", () => {
    render(<ElementActionsMenu {...defaultProps} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows menu when menuOpen is true", () => {
    render(<ElementActionsMenu {...defaultProps} menuOpen />);
    expect(screen.getByRole("menu", { name: /element actions/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /cut/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
  });

  it("toggles menu when trigger is clicked", () => {
    const setMenuOpen = vi.fn();
    render(
      <ElementActionsMenu {...defaultProps} setMenuOpen={setMenuOpen} />
    );
    fireEvent.click(screen.getByRole("button", { name: /element actions/i }));
    expect(setMenuOpen).toHaveBeenCalledWith(expect.any(Function));
  });

  it("calls onCut and setMenuOpen(false) when Cut is clicked", () => {
    const onCut = vi.fn();
    const setMenuOpen = vi.fn();
    render(
      <ElementActionsMenu
        {...defaultProps}
        menuOpen
        onCut={onCut}
        setMenuOpen={setMenuOpen}
      />
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /cut/i }));
    expect(onCut).toHaveBeenCalled();
    expect(setMenuOpen).toHaveBeenCalledWith(false);
  });

  it("shows Send to Front and Send to Back when handlers provided", () => {
    render(
      <ElementActionsMenu
        {...defaultProps}
        menuOpen
        onSendToBack={vi.fn()}
        onSendToFront={vi.fn()}
      />
    );
    expect(screen.getByRole("menuitem", { name: /send to front/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /send to back/i })).toBeInTheDocument();
  });
});
