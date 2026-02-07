import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { ElementContextMenu } from "./ElementContextMenu";

function createRef(): React.RefObject<HTMLDivElement> {
  return { current: null };
}

describe("ElementContextMenu", () => {
  const defaultProps = {
    onCut: vi.fn(),
    onCopy: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    position: { x: 0, y: 0 } as { x: number; y: number } | null,
    onClose: vi.fn(),
    menuRef: createRef(),
  };

  it("returns null when position is null", () => {
    const { container } = render(
      <ElementContextMenu {...defaultProps} position={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders menu with Cut, Copy, Duplicate, Delete when position is set", () => {
    render(<ElementContextMenu {...defaultProps} />);
    expect(screen.getByRole("menu", { name: /element actions/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /cut/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /duplicate/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
  });

  it("calls onCut and onClose when Cut is clicked", () => {
    const onCut = vi.fn();
    const onClose = vi.fn();
    render(
      <ElementContextMenu
        {...defaultProps}
        onCut={onCut}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /cut/i }));
    expect(onCut).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onDelete and onClose when Delete is clicked", () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(
      <ElementContextMenu
        {...defaultProps}
        onDelete={onDelete}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows Send to Front and Send to Back when handlers provided", () => {
    render(
      <ElementContextMenu
        {...defaultProps}
        onSendToBack={vi.fn()}
        onSendToFront={vi.fn()}
      />
    );
    expect(screen.getByRole("menuitem", { name: /send to front/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /send to back/i })).toBeInTheDocument();
  });

  it("does not show Send to Front/Back when handlers not provided", () => {
    render(<ElementContextMenu {...defaultProps} />);
    expect(screen.queryByRole("menuitem", { name: /send to front/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /send to back/i })).not.toBeInTheDocument();
  });
});
