import { render, fireEvent } from "@testing-library/react";
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

  it("renders the toolbar with an add-text button", () => {
    render(withQueryClient(<WhiteboardCanvas />));
    const button = document.querySelector("button[aria-label='Add text']");
    expect(button).toBeInTheDocument();
  });

  it("creates a text element when clicking the add-text button", () => {
    const { container } = render(withQueryClient(<WhiteboardCanvas />));
    const button = container.querySelector<HTMLButtonElement>(
      "button[aria-label='Add text']"
    );
    expect(button).toBeInTheDocument();
    if (!button) return;

    fireEvent.click(button);

    const textDisplay = container.querySelector(".whiteboard-text-display");
    expect(textDisplay).toBeInTheDocument();
  });
});
