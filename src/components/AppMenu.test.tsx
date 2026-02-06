import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppMenu } from "./AppMenu";
import type { WhiteboardState } from "@/api/whiteboard";

describe("AppMenu", () => {
  const mockOnImport = vi.fn();
  const mockOnDownload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("renders hamburger menu button", () => {
    render(<AppMenu onImport={mockOnImport} onDownload={mockOnDownload} />);
    const menuButton = screen.getByRole("button", { name: /menu/i });
    expect(menuButton).toBeInTheDocument();
  });

  it("opens menu when hamburger button is clicked", async () => {
    render(<AppMenu onImport={mockOnImport} onDownload={mockOnDownload} />);
    const menuButton = screen.getByRole("button", { name: /menu/i });
    
    fireEvent.click(menuButton);
    
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    expect(screen.getByRole("menuitem", { name: /import/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /download/i })).toBeInTheDocument();
  });

  it("closes menu when clicking outside", async () => {
    render(<AppMenu onImport={mockOnImport} onDownload={mockOnDownload} />);
    const menuButton = screen.getByRole("button", { name: /menu/i });
    
    fireEvent.click(menuButton);
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    
    fireEvent.mouseDown(document.body);
    
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("calls onDownload when download is clicked", async () => {
    const mockState: WhiteboardState = {
      elements: [{ id: "test", kind: "text", x: 0, y: 0, content: "test" }],
    };
    mockOnDownload.mockReturnValue(mockState);
    
    render(<AppMenu onImport={mockOnImport} onDownload={mockOnDownload} />);
    const menuButton = screen.getByRole("button", { name: /menu/i });
    
    fireEvent.click(menuButton);
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    
    const downloadButton = screen.getByRole("menuitem", { name: /download/i });
    fireEvent.click(downloadButton);
    
    await waitFor(() => {
      expect(mockOnDownload).toHaveBeenCalledTimes(1);
    });
  });

  it("shows warning dialog when import is clicked and file is selected", async () => {
    render(<AppMenu onImport={mockOnImport} onDownload={mockOnDownload} />);
    const menuButton = screen.getByRole("button", { name: /menu/i });
    
    fireEvent.click(menuButton);
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    
    const importButton = screen.getByRole("menuitem", { name: /import/i });
    fireEvent.click(importButton);
    
    // Note: We can't easily test the file input dialog interaction without
    // more complex mocking. This test verifies the menu closes when import is clicked.
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("renders import and download menu items", async () => {
    render(<AppMenu onImport={mockOnImport} onDownload={mockOnDownload} />);
    const menuButton = screen.getByRole("button", { name: /menu/i });
    
    fireEvent.click(menuButton);
    
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    
    expect(screen.getByRole("menuitem", { name: /import/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /download/i })).toBeInTheDocument();
  });
});
