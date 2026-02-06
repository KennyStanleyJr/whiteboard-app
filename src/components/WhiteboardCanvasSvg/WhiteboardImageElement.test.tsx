import React from "react";
import { render } from "@testing-library/react";
import { WhiteboardImageElement } from "./WhiteboardImageElement";
import type { ImageElement } from "@/types/whiteboard";

const imageElement: ImageElement = {
  id: "i1",
  kind: "image",
  x: 10,
  y: 20,
  src: "data:image/png;base64,test",
  width: 100,
  height: 80,
};

function renderInSvg(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<svg>{ui}</svg>);
}

describe("WhiteboardImageElement", () => {
  it("renders an image element with correct attributes", () => {
    const { container } = renderInSvg(
      <WhiteboardImageElement element={imageElement} />
    );
    const image = container.querySelector("image");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("href", "data:image/png;base64,test");
    expect(image).toHaveAttribute("x", "10");
    expect(image).toHaveAttribute("y", "20");
    expect(image).toHaveAttribute("width", "100");
    expect(image).toHaveAttribute("height", "80");
  });

  it("uses contain (meet) by default", () => {
    const { container } = renderInSvg(
      <WhiteboardImageElement element={imageElement} />
    );
    const image = container.querySelector("image");
    expect(image).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
  });

  it("uses fill (none) when imageFill is true", () => {
    const { container } = renderInSvg(
      <WhiteboardImageElement
        element={{ ...imageElement, imageFill: true }}
      />
    );
    const image = container.querySelector("image");
    expect(image).toHaveAttribute("preserveAspectRatio", "none");
  });

  it("renders clipPath with rounded corners when imageCornerRadius is set", () => {
    const { container } = renderInSvg(
      <WhiteboardImageElement
        element={{ ...imageElement, imageCornerRadius: "small" }}
      />
    );
    const clipPath = container.querySelector("clipPath");
    expect(clipPath).toBeInTheDocument();
    const rect = clipPath?.querySelector("rect");
    expect(rect).toHaveAttribute("rx");
    expect(Number(rect?.getAttribute("rx"))).toBeGreaterThan(0);
  });

  it("uses meet rect for clipPath when imageFill is false and natural dimensions exist", () => {
    const el = {
      ...imageElement,
      width: 200,
      height: 100,
      naturalWidth: 100,
      naturalHeight: 100,
      imageFill: false,
      imageCornerRadius: "small" as const,
    };
    const { container } = renderInSvg(<WhiteboardImageElement element={el} />);
    const rect = container.querySelector("clipPath rect");
    expect(rect).toBeInTheDocument();
    const clipW = Number(rect?.getAttribute("width"));
    const clipH = Number(rect?.getAttribute("height"));
    expect(clipW).toBe(100);
    expect(clipH).toBe(100);
  });

  it("uses viewport for clipPath when imageFill is true", () => {
    const el = {
      ...imageElement,
      width: 150,
      height: 100,
      imageFill: true,
      imageCornerRadius: "large" as const,
    };
    const { container } = renderInSvg(<WhiteboardImageElement element={el} />);
    const rect = container.querySelector("clipPath rect");
    expect(rect).toHaveAttribute("width", "150");
    expect(rect).toHaveAttribute("height", "100");
  });

  it("uses full radius (50% of min dimension) when imageCornerRadius is full", () => {
    const el = {
      ...imageElement,
      width: 100,
      height: 80,
      imageCornerRadius: "full" as const,
    };
    const { container } = renderInSvg(<WhiteboardImageElement element={el} />);
    const rect = container.querySelector("clipPath rect");
    expect(Number(rect?.getAttribute("rx"))).toBe(40);
    expect(Number(rect?.getAttribute("ry"))).toBe(40);
  });

  it("falls back to viewport when natural dimensions are zero", () => {
    const el = {
      ...imageElement,
      width: 100,
      height: 80,
      naturalWidth: 0,
      naturalHeight: 0,
      imageFill: false,
      imageCornerRadius: "small" as const,
    };
    const { container } = renderInSvg(<WhiteboardImageElement element={el} />);
    const rect = container.querySelector("clipPath rect");
    expect(rect).toHaveAttribute("width", "100");
    expect(rect).toHaveAttribute("height", "80");
  });
});
