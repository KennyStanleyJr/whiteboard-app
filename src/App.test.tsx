import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach } from "vitest";
import App from "./App";
import { withQueryClient } from "@/test/utils";
import { addBoard } from "./api/boards";

describe("App", () => {
  beforeEach(() => {
    window.location.hash = "";
    localStorage.clear();
  });

  it("renders whiteboard header with editable name input", async () => {
    render(withQueryClient(<App />));
    const nameInput = await screen.findByPlaceholderText("Whiteboard name");
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveValue("Whiteboard");
  });

  it("renders whiteboard canvas", async () => {
    const { container } = render(withQueryClient(<App />));
    await screen.findByPlaceholderText("Whiteboard name");
    const root = container.querySelector(".whiteboard-canvas-wrap");
    expect(root).toBeInTheDocument();
  });

  it("toggles management page via header button", async () => {
    window.location.hash = "";
    render(withQueryClient(<App />));

    const toggleButton = screen.getByRole("button", {
      name: /open whiteboard management/i,
    });

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(window.location.hash).toBe("#/manage");
    });

    const closeButton = await screen.findByRole("button", {
      name: /close whiteboard management/i,
    });
    expect(closeButton).toBeInTheDocument();

    const managementMain = screen.getByRole("main");
    expect(managementMain).toHaveClass("visible");
    expect(managementMain).toHaveAttribute("aria-hidden", "false");
  });

  it("creates a new whiteboard when clicking New Whiteboard button", async () => {
    render(withQueryClient(<App />));

    const toggleButton = screen.getByRole("button", {
      name: /open whiteboard management/i,
    });
    fireEvent.click(toggleButton);

    const createButton = await screen.findByRole("button", {
      name: /create new whiteboard/i,
    });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(window.location.hash).toBe("");
    });

    // Should have navigated to canvas view (main loses "visible" after hashchange)
    const managementMain = screen.getByRole("main", { hidden: true });
    await waitFor(() => {
      expect(managementMain).not.toHaveClass("visible");
    });
  });

  it("shows Upload button on management page", async () => {
    render(withQueryClient(<App />));

    const toggleButton = screen.getByRole("button", {
      name: /open whiteboard management/i,
    });
    fireEvent.click(toggleButton);

    const uploadButton = await screen.findByRole("button", {
      name: /upload/i,
    });
    expect(uploadButton).toBeInTheDocument();
  });

  it("opens an existing board and closes management page", async () => {
    render(withQueryClient(<App />));

    const toggleButton = screen.getByRole("button", {
      name: /open whiteboard management/i,
    });
    fireEvent.click(toggleButton);

    const boardText = await screen.findByText("Whiteboard", { selector: "span" });
    const boardButton = boardText.closest("button");
    expect(boardButton).toBeDefined();
    if (boardButton != null) {
      fireEvent.click(boardButton);
    }

    await waitFor(() => {
      expect(window.location.hash).toBe("");
    });

    const managementMain = screen.getByRole("main", { hidden: true });
    await waitFor(() => {
      expect(managementMain).not.toHaveClass("visible");
    });
  });

  it("shows delete confirmation dialog when clicking delete", async () => {
    await addBoard("Other Board"); // two boards so delete opens dialog (last board cannot be deleted)
    render(withQueryClient(<App />));

    const toggleButton = screen.getByRole("button", {
      name: /open whiteboard management/i,
    });
    fireEvent.click(toggleButton);

    // Find board card and open menu (same pattern as "deletes board when confirming deletion")
    const boardText = await screen.findByText("Whiteboard", { selector: "span" });
    const card = boardText.closest(".board-card-wrapper");
    expect(card).toBeDefined();
    const menuButton = card?.querySelector('button[aria-label*="Menu"]') as HTMLElement;
    expect(menuButton).toBeDefined();
    fireEvent.click(menuButton);

    const deleteMenuItem = await screen.findByRole("menuitem", {
      name: /delete/i,
    });
    fireEvent.click(deleteMenuItem);

    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText(/delete whiteboard/i)).toBeInTheDocument();
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
  });

  it("cancels deletion when clicking Cancel in dialog", async () => {
    await addBoard("Other Board"); // two boards so delete opens dialog
    render(withQueryClient(<App />));

    const toggleButton = screen.getByRole("button", {
      name: /open whiteboard management/i,
    });
    fireEvent.click(toggleButton);

    const boardText = await screen.findByText("Whiteboard", { selector: "span" });
    const card = boardText.closest(".board-card-wrapper");
    expect(card).toBeDefined();
    const menuButton = card?.querySelector('button[aria-label*="Menu"]') as HTMLElement;
    expect(menuButton).toBeDefined();
    fireEvent.click(menuButton);

    const deleteMenuItem = await screen.findByRole("menuitem", {
      name: /delete/i,
    });
    fireEvent.click(deleteMenuItem);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    const dialog = screen.getByRole("dialog");
    const cancelButton = within(dialog).getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Board should still exist
    expect(screen.getByText("Whiteboard", { selector: "span" })).toBeInTheDocument();
  });

  it("deletes board when confirming deletion", async () => {
    // Create a second board so we can delete one
    await addBoard("Board to Delete");

    render(withQueryClient(<App />));

    const toggleButton = screen.getByRole("button", {
      name: /open whiteboard management/i,
    });
    fireEvent.click(toggleButton);

    // Find the board to delete
    const boardToDelete = await screen.findByText("Board to Delete", { selector: "span" });
    const card = boardToDelete.closest(".board-card-wrapper");
    expect(card).toBeDefined();

    // Open menu for that board
    const menuButton = card?.querySelector('button[aria-label*="Menu"]') as HTMLElement;
    expect(menuButton).toBeDefined();
    fireEvent.click(menuButton);

    // Click delete
    const deleteMenuItem = await screen.findByRole("menuitem", {
      name: /delete board to delete/i,
    });
    fireEvent.click(deleteMenuItem);

    // Confirm deletion
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmButton);

    // Board should be removed
    await waitFor(() => {
      expect(screen.queryByText("Board to Delete", { selector: "span" })).not.toBeInTheDocument();
    });

    // Dialog should be closed
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
