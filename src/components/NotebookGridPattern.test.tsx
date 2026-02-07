import { render } from "@testing-library/react";
import { NotebookGridPattern, NOTEBOOK_PATTERN_ID } from "./NotebookGridPattern";
import { GRID_OPACITY, GRID_SPACING } from "@/lib/gridPatternConstants";

describe("NotebookGridPattern", () => {
  it("renders an SVG pattern element", () => {
    const { container } = render(
      <svg>
        <defs>
          <NotebookGridPattern color="#000000" />
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
          <NotebookGridPattern color="#000000" />
        </defs>
      </svg>
    );
    const pattern = container.querySelector(`#${NOTEBOOK_PATTERN_ID}`);
    expect(pattern).toBeInTheDocument();
  });

  it("renders one horizontal line inside the pattern", () => {
    const { container } = render(
      <svg>
        <defs>
          <NotebookGridPattern color="#000000" />
        </defs>
      </svg>
    );
    const lines = container.querySelectorAll("line");
    expect(lines).toHaveLength(1);
    const line = lines[0];
    expect(line).toHaveAttribute("y1", String(GRID_SPACING / 2));
    expect(line).toHaveAttribute("y2", String(GRID_SPACING / 2));
  });

  it("uses GRID_SPACING for pattern dimensions", () => {
    const { container } = render(
      <svg>
        <defs>
          <NotebookGridPattern color="#000000" />
        </defs>
      </svg>
    );
    const pattern = container.querySelector("pattern");
    expect(pattern).toHaveAttribute("width", String(GRID_SPACING));
    expect(pattern).toHaveAttribute("height", String(GRID_SPACING));
  });

  it("applies color and opacity to the line", () => {
    const { container } = render(
      <svg>
        <defs>
          <NotebookGridPattern color="#666666" />
        </defs>
      </svg>
    );
    const line = container.querySelector("line");
    expect(line).toHaveAttribute("stroke", "#666666");
    expect(line).toHaveAttribute("stroke-opacity", String(GRID_OPACITY));
  });
});
