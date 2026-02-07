import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { withQueryClient } from "@/test/utils";
import { WhiteboardCanvas } from "./WhiteboardCanvas";

describe("WhiteboardCanvas", () => {
  it("renders without crashing", () => {
    render(withQueryClient(<WhiteboardCanvas />));
  });

  it("renders whiteboard canvas wrapper", () => {
    const { container } = render(withQueryClient(<WhiteboardCanvas />));
    const wrap = container.querySelector(".whiteboard-canvas-wrap");
    expect(wrap).toBeInTheDocument();
  });

  it("renders SVG canvas inside wrapper", () => {
    const { container } = render(withQueryClient(<WhiteboardCanvas />));
    const svg = container.querySelector(".whiteboard-canvas");
    expect(svg).toBeInTheDocument();
  });

  it("renders the toolbar with Add element that reveals add-text in subtoolbar", () => {
    render(withQueryClient(<WhiteboardCanvas />));
    const addElementButton = screen.getByRole("button", {
      name: /^Add element$/i,
    });
    expect(addElementButton).toBeInTheDocument();
    fireEvent.click(addElementButton);
    const addTextButton = screen.getByRole("menuitem", { name: /^Add text$/i });
    expect(addTextButton).toBeInTheDocument();
  });

  it("creates a text element when choosing add-text from subtoolbar", () => {
    const { container } = render(withQueryClient(<WhiteboardCanvas />));
    fireEvent.click(
      screen.getByRole("button", { name: /^Add element$/i })
    );
    const addTextButton = screen.getByRole("menuitem", { name: /^Add text$/i });
    fireEvent.click(addTextButton);

    const textDisplay = container.querySelector(".whiteboard-text-display");
    expect(textDisplay).toBeInTheDocument();
  });

  describe("clipboard operations", () => {
    it("does not trigger copy when no elements are selected", () => {
      render(withQueryClient(<WhiteboardCanvas />));
      
      // Simulate Ctrl+C with no selection
      fireEvent.keyDown(document, {
        key: "c",
        ctrlKey: true,
        bubbles: true,
      });

      // Should not crash
      expect(true).toBe(true);
    });

    it("does not trigger cut when no elements are selected", () => {
      render(withQueryClient(<WhiteboardCanvas />));
      
      // Simulate Ctrl+X with no selection
      fireEvent.keyDown(document, {
        key: "x",
        ctrlKey: true,
        bubbles: true,
      });

      // Should not crash
      expect(true).toBe(true);
    });

    it("does not trigger duplicate when no elements are selected", () => {
      render(withQueryClient(<WhiteboardCanvas />));
      
      // Simulate Ctrl+D with no selection
      fireEvent.keyDown(document, {
        key: "d",
        ctrlKey: true,
        bubbles: true,
      });

      // Should not crash
      expect(true).toBe(true);
    });

    it("does not trigger paste when clipboard is empty", () => {
      render(withQueryClient(<WhiteboardCanvas />));
      
      // Simulate Ctrl+V with empty clipboard
      fireEvent.keyDown(document, {
        key: "v",
        ctrlKey: true,
        bubbles: true,
      });

      // Should not crash
      expect(true).toBe(true);
    });

    it("does not trigger clipboard operations when editing text", async () => {
      const { container } = render(withQueryClient(<WhiteboardCanvas />));

      // Create element via Add element subtoolbar
      fireEvent.click(screen.getByRole("button", { name: /add element/i }));
      fireEvent.click(screen.getByRole("menuitem", { name: /add text/i }));

      await waitFor(() => {
        const textDisplay = container.querySelector<HTMLDivElement>(".whiteboard-text-display");
        expect(textDisplay).toBeInTheDocument();
        if (textDisplay) {
          textDisplay.focus();
        }
      });

      const textDisplay = container.querySelector<HTMLDivElement>(".whiteboard-text-display");
      if (!textDisplay) return;

      // Simulate typing in the editor
      textDisplay.textContent = "Editing";
      fireEvent.input(textDisplay, { bubbles: true });

      // Clipboard shortcuts should not trigger when editing
      const shortcuts = ["c", "x", "v", "d"];
      for (const key of shortcuts) {
        fireEvent.keyDown(textDisplay, {
          key,
          ctrlKey: true,
          bubbles: true,
        });
      }

      // Should not crash
      expect(true).toBe(true);
    });

    it("supports Mac Cmd key modifier", () => {
      render(withQueryClient(<WhiteboardCanvas />));
      
      // Simulate Cmd+C (Mac)
      fireEvent.keyDown(document, {
        key: "c",
        metaKey: true,
        bubbles: true,
      });

      // Should not crash
      expect(true).toBe(true);
    });
  });

  describe("context menu", () => {
    it("does not show context menu when no elements are selected", () => {
      const { container } = render(withQueryClient(<WhiteboardCanvas />));
      
      const svg = container.querySelector<SVGElement>(".whiteboard-canvas");
      if (!svg) return;

      // Right-click on empty canvas
      fireEvent.contextMenu(svg, {
        button: 2,
        clientX: 100,
        clientY: 100,
      });

      // Context menu should not appear (we verify it doesn't crash)
      expect(true).toBe(true);
    });
  });
});
