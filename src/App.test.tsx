import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("renders whiteboard header", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /whiteboard/i })).toBeInTheDocument();
  });

  it("renders whiteboard canvas", () => {
    const { container } = render(<App />);
    const canvas = container.querySelector(".app");
    expect(canvas).toBeInTheDocument();
  });

  it("toggles management page via header button", async () => {
    window.location.hash = "";
    render(<App />);

    const toggleButton = screen.getByRole("button", {
      name: /open whiteboard management/i,
    });

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(window.location.hash).toBe("#/manage");
    });

    const closeButton = screen.getByRole("button", {
      name: /close whiteboard management/i,
    });
    expect(closeButton).toBeInTheDocument();

    const managementMain = screen.getByRole("main");
    expect(managementMain).toHaveClass("is-open");
    expect(managementMain).toHaveAttribute("aria-hidden", "false");
  });

  it("calls handler when creating a new whiteboard", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    render(<App />);

    const toggleButton = screen.getByRole("button", {
      name: /open whiteboard management/i,
    });
    fireEvent.click(toggleButton);

    const createButton = await screen.findByRole("listitem", {
      name: /create new whiteboard/i,
    });
    fireEvent.click(createButton);

    expect(logSpy).toHaveBeenCalledWith("Create new board");

    logSpy.mockRestore();
  });

  it("opens an existing board and closes management page", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    render(<App />);

    const toggleButton = screen.getByRole("button", {
      name: /open whiteboard management/i,
    });
    fireEvent.click(toggleButton);

    const boardItems = await screen.findAllByRole("listitem");
    expect(boardItems).toHaveLength(2);

    const existingBoardButton = boardItems[1];
    expect(existingBoardButton).toBeDefined();
    fireEvent.click(existingBoardButton!);

    expect(logSpy).toHaveBeenCalledWith("Open board board-1");
    expect(window.location.hash).toBe("");

    logSpy.mockRestore();
  });
});
