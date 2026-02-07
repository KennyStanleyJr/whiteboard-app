import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { ElementContextMenu, ElementActionsMenu } from "./ElementContextMenu";

function createRef(): React.RefObject<HTMLDivElement> {
  return { current: null };
}

describe("ElementContextMenu", () => {
  describe("ElementContextMenu (right-click)", () => {
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

    it("shows Get info when onGetImageInfo provided", () => {
      render(
        <ElementContextMenu {...defaultProps} onGetImageInfo={vi.fn()} />
      );
      expect(screen.getByRole("menuitem", { name: /get info/i })).toBeInTheDocument();
    });

    it("does not show Get info when onGetImageInfo not provided", () => {
      render(<ElementContextMenu {...defaultProps} />);
      expect(screen.queryByRole("menuitem", { name: /get info/i })).not.toBeInTheDocument();
    });

    it("calls onGetImageInfo and onClose when Get info is clicked", () => {
      const onGetImageInfo = vi.fn();
      const onClose = vi.fn();
      render(
        <ElementContextMenu
          {...defaultProps}
          onGetImageInfo={onGetImageInfo}
          onClose={onClose}
        />
      );
      fireEvent.click(screen.getByRole("menuitem", { name: /get info/i }));
      expect(onGetImageInfo).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("ElementActionsMenu (toolbar)", () => {
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

    it("shows Get info when onGetImageInfo provided", () => {
      render(
        <ElementActionsMenu {...defaultProps} menuOpen onGetImageInfo={vi.fn()} />
      );
      expect(screen.getByRole("menuitem", { name: /get info/i })).toBeInTheDocument();
    });

    it("does not show Get info when onGetImageInfo not provided", () => {
      render(<ElementActionsMenu {...defaultProps} menuOpen />);
      expect(screen.queryByRole("menuitem", { name: /get info/i })).not.toBeInTheDocument();
    });

    it("calls onGetImageInfo and setMenuOpen(false) when Get info is clicked", () => {
      const onGetImageInfo = vi.fn();
      const setMenuOpen = vi.fn();
      render(
        <ElementActionsMenu
          {...defaultProps}
          menuOpen
          onGetImageInfo={onGetImageInfo}
          setMenuOpen={setMenuOpen}
        />
      );
      fireEvent.click(screen.getByRole("menuitem", { name: /get info/i }));
      expect(onGetImageInfo).toHaveBeenCalled();
      expect(setMenuOpen).toHaveBeenCalledWith(false);
    });
  });
});
