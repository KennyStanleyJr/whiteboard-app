import { render } from "@testing-library/react";
import { LineGridPattern, LINE_PATTERN_ID } from "./LineGridPattern";
import { GRID_OPACITY, GRID_SPACING } from "@/lib/gridPatternConstants";

describe("LineGridPattern", () => {
  it("renders an SVG pattern element", () => {
    const { container } = render(
      <svg>
        <defs>
          <LineGridPattern color="#000000" />
        </defs>
      </svg>
    );
    const pattern = container.querySelector("pattern");
    expect(pattern).toBeInTheDocument();
  });

  it("uses correct pattern id", () => {
    const { container } = render(
      <svg>
        <defs>
          <LineGridPattern color="#000000" />
        </defs>
      </svg>
    );
    const pattern = container.querySelector(`#${LINE_PATTERN_ID}`);
    expect(pattern).toBeInTheDocument();
  });

  it("renders two lines (vertical and horizontal) inside the pattern", () => {
    const { container } = render(
      <svg>
        <defs>
          <LineGridPattern color="#000000" />
        </defs>
      </svg>
    );
    const lines = container.querySelectorAll("line");
    expect(lines).toHaveLength(2);
  });

  it("uses GRID_SPACING for pattern dimensions", () => {
    const { container } = render(
      <svg>
        <defs>
          <LineGridPattern color="#000000" />
        </defs>
      </svg>
    );
    const pattern = container.querySelector("pattern");
    expect(pattern).toHaveAttribute("width", String(GRID_SPACING));
    expect(pattern).toHaveAttribute("height", String(GRID_SPACING));
  });

  it("applies color and opacity to lines", () => {
    const { container } = render(
      <svg>
        <defs>
          <LineGridPattern color="#333333" />
        </defs>
      </svg>
    );
    const firstLine = container.querySelector("line");
    expect(firstLine).toHaveAttribute("stroke", "#333333");
    expect(firstLine).toHaveAttribute("stroke-opacity", String(GRID_OPACITY));
  });
});
