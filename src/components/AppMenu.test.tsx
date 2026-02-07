import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AppMenu } from "./AppMenu";
import type { WhiteboardState } from "@/api/whiteboard";
import type { GridStyle } from "@/lib/canvasPreferences";
import { DEFAULT_CANVAS_PREFERENCES } from "@/lib/canvasPreferences";

const defaultMenuProps = {
  onUpload: vi.fn(),
  onDownload: vi.fn(),
  currentBoardName: "Whiteboard",
  boardBackgroundColor: "#ffffff",
  boardGridStyle: "dotted" as GridStyle,
  onBoardAppearanceChange: vi.fn(),
  canvasPreferences: DEFAULT_CANVAS_PREFERENCES,
  onCanvasPreferenceChange: vi.fn(),
};

const validWhiteboardJson = JSON.stringify({
  elements: [{ id: "el1", kind: "text", x: 0, y: 0, content: "hello" }],
});

/**
 * Capture the file input created when Upload is clicked and simulate selecting a file.
 * Returns the captured input so tests can trigger onchange with a given file.
 */
function openMenuClickUploadAndCaptureFileInput(): HTMLInputElement | null {
  let fileInput: HTMLInputElement | null = null;
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
    const el = createElement(tagName);
    if (tagName.toLowerCase() === "input") {
      fileInput = el as HTMLInputElement;
    }
    return el;
  });

  const menuButton = screen.getByRole("button", { name: /menu/i });
  fireEvent.click(menuButton);
  const uploadButton = screen.getByRole("menuitem", { name: /upload/i });
  fireEvent.click(uploadButton);

  return fileInput;
}

/**
 * Simulate user selecting a file: trigger the captured input's onchange with one file.
 */
function simulateFileSelection(
  input: HTMLInputElement,
  file: File
): void {
  const fileList = { 0: file, length: 1 } as unknown as FileList;
  Object.defineProperty(input, "files", {
    value: fileList,
    configurable: true,
  });
  fireEvent.change(input, { target: input });
}

describe("AppMenu", () => {
  const mockOnUpload = vi.fn();
  const mockOnDownload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders hamburger menu button", () => {
    render(
      <AppMenu
        {...defaultMenuProps}
        onUpload={mockOnUpload}
        onDownload={mockOnDownload}
      />
    );
    const menuButton = screen.getByRole("button", { name: /menu/i });
    expect(menuButton).toBeInTheDocument();
  });

  it("opens menu when hamburger button is clicked", async () => {
    render(
      <AppMenu
        {...defaultMenuProps}
        onUpload={mockOnUpload}
        onDownload={mockOnDownload}
      />
    );
    const menuButton = screen.getByRole("button", { name: /menu/i });
    
    fireEvent.click(menuButton);
    
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    expect(screen.getByRole("menuitem", { name: /upload/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /download/i })).toBeInTheDocument();
  });

  it("closes menu when clicking outside", async () => {
    render(
      <AppMenu
        {...defaultMenuProps}
        onUpload={mockOnUpload}
        onDownload={mockOnDownload}
      />
    );
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
    
    render(
      <AppMenu
        {...defaultMenuProps}
        onUpload={mockOnUpload}
        onDownload={mockOnDownload}
      />
    );
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

  it("closes menu when Upload is clicked (file picker opens off-screen)", async () => {
    render(
      <AppMenu
        {...defaultMenuProps}
        onUpload={mockOnUpload}
        onDownload={mockOnDownload}
      />
    );
    const menuButton = screen.getByRole("button", { name: /menu/i });
    
    fireEvent.click(menuButton);
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    
    const uploadButton = screen.getByRole("menuitem", { name: /upload/i });
    fireEvent.click(uploadButton);
    
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("renders upload and download menu items", async () => {
    render(
      <AppMenu
        {...defaultMenuProps}
        onUpload={mockOnUpload}
        onDownload={mockOnDownload}
      />
    );
    const menuButton = screen.getByRole("button", { name: /menu/i });
    
    fireEvent.click(menuButton);
    
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
    
    expect(screen.getByRole("menuitem", { name: /upload/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /download/i })).toBeInTheDocument();
  });

  describe("Upload flow: file picker then Append/Replace dialog", () => {
    it("shows Add content from file dialog with both can be undone hint after file is selected", async () => {
      render(
        <AppMenu
          {...defaultMenuProps}
          onUpload={mockOnUpload}
          onDownload={mockOnDownload}
        />
      );
      const input = openMenuClickUploadAndCaptureFileInput();
      expect(input).not.toBeNull();
      const file = new File([validWhiteboardJson], "board.json", {
        type: "application/json",
      });
      simulateFileSelection(input!, file);

      await waitFor(() => {
        expect(
          screen.getByRole("dialog", { name: /add content from file/i })
        ).toBeInTheDocument();
      });
      expect(
        screen.getByRole("button", { name: /^append content$/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^replace content$/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/both can be undone/i)).toBeInTheDocument();
    });

    it("closes mode choice dialog when Cancel is clicked", async () => {
      render(
        <AppMenu
          {...defaultMenuProps}
          onUpload={mockOnUpload}
          onDownload={mockOnDownload}
        />
      );
      const input = openMenuClickUploadAndCaptureFileInput();
      const file = new File([validWhiteboardJson], "board.json", {
        type: "application/json",
      });
      simulateFileSelection(input!, file);

      await waitFor(() => {
        expect(
          screen.getByRole("dialog", { name: /add content from file/i })
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: /add content from file/i })
        ).not.toBeInTheDocument();
      });
      expect(mockOnUpload).not.toHaveBeenCalled();
    });

    it("closes mode choice dialog when Escape is pressed", async () => {
      render(
        <AppMenu
          {...defaultMenuProps}
          onUpload={mockOnUpload}
          onDownload={mockOnDownload}
        />
      );
      const input = openMenuClickUploadAndCaptureFileInput();
      const file = new File([validWhiteboardJson], "board.json", {
        type: "application/json",
      });
      simulateFileSelection(input!, file);

      await waitFor(() => {
        expect(
          screen.getByRole("dialog", { name: /add content from file/i })
        ).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: "Escape" });

      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: /add content from file/i })
        ).not.toBeInTheDocument();
      });
      expect(mockOnUpload).not.toHaveBeenCalled();
    });

    it("calls onUpload with append mode when Append content is chosen", async () => {
      render(
        <AppMenu
          {...defaultMenuProps}
          onUpload={mockOnUpload}
          onDownload={mockOnDownload}
        />
      );
      const input = openMenuClickUploadAndCaptureFileInput();
      const file = new File([validWhiteboardJson], "board.json", {
        type: "application/json",
      });
      simulateFileSelection(input!, file);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^append content$/i })
        ).toBeInTheDocument();
      });
      fireEvent.click(
        screen.getByRole("button", { name: /^append content$/i })
      );

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledTimes(1);
        expect(mockOnUpload).toHaveBeenCalledWith(
          expect.objectContaining({
            elements: [{ id: "el1", kind: "text", x: 0, y: 0, content: "hello" }],
          }),
          { mode: "append" }
        );
      });
    });

    it("calls onUpload with replace mode when Replace content is chosen", async () => {
      render(
        <AppMenu
          {...defaultMenuProps}
          onUpload={mockOnUpload}
          onDownload={mockOnDownload}
        />
      );
      const input = openMenuClickUploadAndCaptureFileInput();
      const file = new File([validWhiteboardJson], "board.json", {
        type: "application/json",
      });
      simulateFileSelection(input!, file);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /^replace content$/i })
        ).toBeInTheDocument();
      });
      fireEvent.click(
        screen.getByRole("button", { name: /^replace content$/i })
      );

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledTimes(1);
        expect(mockOnUpload).toHaveBeenCalledWith(
          expect.objectContaining({
            elements: [{ id: "el1", kind: "text", x: 0, y: 0, content: "hello" }],
          }),
          { mode: "replace" }
        );
      });
    });
  });
});
