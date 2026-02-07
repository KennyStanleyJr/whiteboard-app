import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { WhiteboardToolbar } from "./WhiteboardToolbar";

describe("WhiteboardToolbar", () => {
  const defaultProps = {
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    onAddText: vi.fn(),
    onAddRectangle: vi.fn(),
    onAddEllipse: vi.fn(),
    onAddImage: vi.fn(),
  };

  it("renders main toolbar with Undo, Redo, and Add element", () => {
    render(<WhiteboardToolbar {...defaultProps} />);
    expect(screen.getByRole("button", { name: /^Undo$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Redo$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Add element$/i })
    ).toBeInTheDocument();
  });

  it("opens subtoolbar with element options when Add element is clicked", () => {
    render(<WhiteboardToolbar {...defaultProps} />);
    const addElementBtn = screen.getByRole("button", { name: /^Add element$/i });
    expect(addElementBtn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(addElementBtn);
    expect(addElementBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: /^Add text$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^Add rectangle$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^Add ellipse$/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /^Add image$/i })).toBeInTheDocument();
  });

  it("closes subtoolbar when Add element is clicked again", () => {
    render(<WhiteboardToolbar {...defaultProps} />);
    const addElementBtn = screen.getByRole("button", { name: /^Add element$/i });
    fireEvent.click(addElementBtn);
    expect(addElementBtn).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(addElementBtn);
    expect(addElementBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("closes subtoolbar after choosing an option", () => {
    const onAddText = vi.fn();
    render(<WhiteboardToolbar {...defaultProps} onAddText={onAddText} />);
    fireEvent.click(screen.getByRole("button", { name: /^Add element$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^Add text$/i }));
    expect(onAddText).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: /^Add element$/i })
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("calls undo when Undo button is clicked", () => {
    const undo = vi.fn();
    render(<WhiteboardToolbar {...defaultProps} undo={undo} canUndo />);
    fireEvent.click(screen.getByRole("button", { name: /^Undo$/i }));
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("calls redo when Redo button is clicked", () => {
    const redo = vi.fn();
    render(<WhiteboardToolbar {...defaultProps} redo={redo} canRedo />);
    fireEvent.click(screen.getByRole("button", { name: /^Redo$/i }));
    expect(redo).toHaveBeenCalledTimes(1);
  });

  it("calls onAddText when Add text is chosen from subtoolbar", () => {
    const onAddText = vi.fn();
    render(<WhiteboardToolbar {...defaultProps} onAddText={onAddText} />);
    fireEvent.click(screen.getByRole("button", { name: /^Add element$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^Add text$/i }));
    expect(onAddText).toHaveBeenCalledTimes(1);
  });

  it("calls onAddRectangle when Add rectangle is chosen from subtoolbar", () => {
    const onAddRectangle = vi.fn();
    render(<WhiteboardToolbar {...defaultProps} onAddRectangle={onAddRectangle} />);
    fireEvent.click(screen.getByRole("button", { name: /^Add element$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^Add rectangle$/i }));
    expect(onAddRectangle).toHaveBeenCalledTimes(1);
  });

  it("calls onAddEllipse when Add ellipse is chosen from subtoolbar", () => {
    const onAddEllipse = vi.fn();
    render(<WhiteboardToolbar {...defaultProps} onAddEllipse={onAddEllipse} />);
    fireEvent.click(screen.getByRole("button", { name: /^Add element$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^Add ellipse$/i }));
    expect(onAddEllipse).toHaveBeenCalledTimes(1);
  });

  it("calls onAddImage when Add image is chosen from subtoolbar", () => {
    const onAddImage = vi.fn();
    render(<WhiteboardToolbar {...defaultProps} onAddImage={onAddImage} />);
    fireEvent.click(screen.getByRole("button", { name: /^Add element$/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^Add image$/i }));
    expect(onAddImage).toHaveBeenCalledTimes(1);
  });

  it("disables Undo button when canUndo is false", () => {
    render(<WhiteboardToolbar {...defaultProps} canUndo={false} />);
    const undoButton = screen.getByRole("button", { name: /^Undo$/i });
    expect(undoButton).toBeDisabled();
  });

  it("enables Undo button when canUndo is true", () => {
    render(<WhiteboardToolbar {...defaultProps} canUndo />);
    const undoButton = screen.getByRole("button", { name: /^Undo$/i });
    expect(undoButton).not.toBeDisabled();
  });

  it("disables Redo button when canRedo is false", () => {
    render(<WhiteboardToolbar {...defaultProps} canRedo={false} />);
    const redoButton = screen.getByRole("button", { name: /^Redo$/i });
    expect(redoButton).toBeDisabled();
  });

  it("enables Redo button when canRedo is true", () => {
    render(<WhiteboardToolbar {...defaultProps} canRedo />);
    const redoButton = screen.getByRole("button", { name: /^Redo$/i });
    expect(redoButton).not.toBeDisabled();
  });

  it("sets title attribute on Undo button", () => {
    render(<WhiteboardToolbar {...defaultProps} />);
    const undoButton = screen.getByRole("button", { name: /^Undo$/i });
    expect(undoButton).toHaveAttribute("title", "Undo (Ctrl+Z)");
  });

  it("sets title attribute on Redo button", () => {
    render(<WhiteboardToolbar {...defaultProps} />);
    const redoButton = screen.getByRole("button", { name: /^Redo$/i });
    expect(redoButton).toHaveAttribute("title", "Redo (Ctrl+Y)");
  });
});
