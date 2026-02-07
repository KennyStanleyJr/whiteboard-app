import { render } from "@testing-library/react";
import { DotGridPattern, PATTERN_ID } from "./DotGridPattern";

describe("DotGridPattern", () => {
  it("renders an SVG pattern element", () => {
    const { container } = render(
      <svg>
        <defs>
          <DotGridPattern />
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
          <DotGridPattern />
        </defs>
      </svg>
    );
    const pattern = container.querySelector(`#${PATTERN_ID}`);
    expect(pattern).toBeInTheDocument();
  });

  it("renders a circle inside the pattern", () => {
    const { container } = render(
      <svg>
        <defs>
          <DotGridPattern />
        </defs>
      </svg>
    );
    const circle = container.querySelector("circle");
    expect(circle).toBeInTheDocument();
  });
});
