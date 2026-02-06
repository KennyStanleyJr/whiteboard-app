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
  };

  it("renders all toolbar buttons", () => {
    render(<WhiteboardToolbar {...defaultProps} />);
    expect(screen.getByRole("button", { name: /^Undo$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Redo$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Add text$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Add rectangle$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Add ellipse$/i })).toBeInTheDocument();
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

  it("calls onAddText when Add text button is clicked", () => {
    const onAddText = vi.fn();
    render(<WhiteboardToolbar {...defaultProps} onAddText={onAddText} />);
    fireEvent.click(screen.getByRole("button", { name: /^Add text$/i }));
    expect(onAddText).toHaveBeenCalledTimes(1);
  });

  it("calls onAddRectangle when Add rectangle button is clicked", () => {
    const onAddRectangle = vi.fn();
    render(<WhiteboardToolbar {...defaultProps} onAddRectangle={onAddRectangle} />);
    fireEvent.click(screen.getByRole("button", { name: /^Add rectangle$/i }));
    expect(onAddRectangle).toHaveBeenCalledTimes(1);
  });

  it("calls onAddEllipse when Add ellipse button is clicked", () => {
    const onAddEllipse = vi.fn();
    render(<WhiteboardToolbar {...defaultProps} onAddEllipse={onAddEllipse} />);
    fireEvent.click(screen.getByRole("button", { name: /^Add ellipse$/i }));
    expect(onAddEllipse).toHaveBeenCalledTimes(1);
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
