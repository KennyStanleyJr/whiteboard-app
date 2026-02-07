import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { CanvasContextMenu } from "./CanvasContextMenu";

function createRef(): React.RefObject<HTMLDivElement> {
  return { current: null };
}

describe("CanvasContextMenu", () => {
  it("returns null when position is null", () => {
    const { container } = render(
      <CanvasContextMenu
        position={null}
        onClose={vi.fn()}
        onPaste={vi.fn()}
        menuRef={createRef()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders menu with Paste when position is set", () => {
    render(
      <CanvasContextMenu
        position={{ x: 10, y: 20 }}
        onClose={vi.fn()}
        onPaste={vi.fn()}
        menuRef={createRef()}
      />
    );
    expect(screen.getByRole("menu", { name: /canvas actions/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /paste/i })).toBeInTheDocument();
  });

  it("positions menu at given coordinates", () => {
    const { container } = render(
      <CanvasContextMenu
        position={{ x: 100, y: 200 }}
        onClose={vi.fn()}
        onPaste={vi.fn()}
        menuRef={createRef()}
      />
    );
    const menu = container.querySelector("[role='menu']");
    expect(menu).toHaveStyle({ left: "100px", top: "200px" });
  });

  it("calls onPaste and onClose when Paste is clicked", () => {
    const onPaste = vi.fn();
    const onClose = vi.fn();
    render(
      <CanvasContextMenu
        position={{ x: 0, y: 0 }}
        onClose={onClose}
        onPaste={onPaste}
        menuRef={createRef()}
      />
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /paste/i }));
    expect(onPaste).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
