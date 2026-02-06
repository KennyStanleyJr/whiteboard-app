import React from "react";
import { render } from "@testing-library/react";
import { WhiteboardShapeElement } from "./WhiteboardShapeElement";
import type { ShapeElement } from "@/types/whiteboard";

const rectElement: ShapeElement = {
  id: "s1",
  kind: "shape",
  shapeType: "rectangle",
  x: 10,
  y: 20,
  width: 100,
  height: 60,
};

const ellipseElement: ShapeElement = {
  id: "s2",
  kind: "shape",
  shapeType: "ellipse",
  x: 50,
  y: 80,
  width: 120,
  height: 80,
};

function renderInSvg(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<svg>{ui}</svg>);
}

describe("WhiteboardShapeElement", () => {
  it("renders a rect for shapeType rectangle", () => {
    const { container } = renderInSvg(
      <WhiteboardShapeElement element={rectElement} />
    );
    const rect = container.querySelector("rect");
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute("x", "10");
    expect(rect).toHaveAttribute("y", "20");
    expect(rect).toHaveAttribute("width", "100");
    expect(rect).toHaveAttribute("height", "60");
  });

  it("renders an ellipse for shapeType ellipse", () => {
    const { container } = renderInSvg(
      <WhiteboardShapeElement element={ellipseElement} />
    );
    const ellipse = container.querySelector("ellipse");
    expect(ellipse).toBeInTheDocument();
    expect(ellipse).toHaveAttribute("cx", "110"); // 50 + 120/2
    expect(ellipse).toHaveAttribute("cy", "120"); // 80 + 80/2
    expect(ellipse).toHaveAttribute("rx", "60");
    expect(ellipse).toHaveAttribute("ry", "40");
  });

  it("uses filled style by default (fill color, no stroke)", () => {
    const { container } = renderInSvg(
      <WhiteboardShapeElement element={rectElement} />
    );
    const rect = container.querySelector("rect");
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute("fill", "#000000");
    expect(rect).toHaveAttribute("stroke", "none");
    expect(rect).toHaveAttribute("stroke-width", "0");
  });

  it("uses outline style when filled is false", () => {
    const el: ShapeElement = { ...rectElement, filled: false };
    const { container } = renderInSvg(
      <WhiteboardShapeElement element={el} />
    );
    const rect = container.querySelector("rect");
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute("fill", "none");
    expect(rect).toHaveAttribute("stroke", "#000000");
    expect(rect).toHaveAttribute("stroke-width", "2");
  });

  it("uses default color when color is undefined", () => {
    const { container } = renderInSvg(
      <WhiteboardShapeElement element={rectElement} />
    );
    const rect = container.querySelector("rect");
    expect(rect).toHaveAttribute("fill", "#000000");
  });

  it("uses custom color when provided", () => {
    const el: ShapeElement = { ...rectElement, color: "#ff0000" };
    const { container } = renderInSvg(
      <WhiteboardShapeElement element={el} />
    );
    const rect = container.querySelector("rect");
    expect(rect).toHaveAttribute("fill", "#ff0000");
  });

  it("outline ellipse uses custom color for stroke", () => {
    const el: ShapeElement = {
      ...ellipseElement,
      filled: false,
      color: "#00ff00",
    };
    const { container } = renderInSvg(
      <WhiteboardShapeElement element={el} />
    );
    const ellipse = container.querySelector("ellipse");
    expect(ellipse).toHaveAttribute("fill", "none");
    expect(ellipse).toHaveAttribute("stroke", "#00ff00");
  });

  it("does not render rect and ellipse at the same time", () => {
    const { container } = renderInSvg(
      <WhiteboardShapeElement element={rectElement} />
    );
    expect(container.querySelector("rect")).toBeInTheDocument();
    expect(container.querySelector("ellipse")).not.toBeInTheDocument();
  });
});
