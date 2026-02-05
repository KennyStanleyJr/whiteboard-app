import { render } from "@testing-library/react";
import { WhiteboardCanvas } from "./WhiteboardCanvas";

describe("WhiteboardCanvas", () => {
  it("renders without crashing", () => {
    render(<WhiteboardCanvas />);
  });

  it("renders whiteboard canvas wrapper", () => {
    const { container } = render(<WhiteboardCanvas />);
    const wrap = container.querySelector(".whiteboard-canvas-wrap");
    expect(wrap).toBeInTheDocument();
  });

  it("renders SVG canvas inside wrapper", () => {
    const { container } = render(<WhiteboardCanvas />);
    const svg = container.querySelector(".whiteboard-canvas");
    expect(svg).toBeInTheDocument();
  });
});
