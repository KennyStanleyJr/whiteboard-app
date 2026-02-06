import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { WhiteboardErrorBoundary } from "./WhiteboardErrorBoundary";

function Thrower({ shouldThrow }: { shouldThrow: boolean }): JSX.Element {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <span data-testid="recovered">Recovered</span>;
}

describe("WhiteboardErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <WhiteboardErrorBoundary>
        <span data-testid="child">Content</span>
      </WhiteboardErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("shows recover UI when a child throws", () => {
    render(
      <WhiteboardErrorBoundary>
        <Thrower shouldThrow={true} />
      </WhiteboardErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recover/i })).toBeInTheDocument();
  });

  it("calls onRecover when recover button is clicked", () => {
    const onRecover = vi.fn();
    render(
      <WhiteboardErrorBoundary onRecover={onRecover}>
        <Thrower shouldThrow={true} />
      </WhiteboardErrorBoundary>
    );

    const button = screen.getByRole("button", { name: /recover/i });
    fireEvent.click(button);

    expect(onRecover).toHaveBeenCalledTimes(1);
  });

  it("re-renders children after recover when child no longer throws", () => {
    function TestApp(): JSX.Element {
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <WhiteboardErrorBoundary onRecover={() => setShouldThrow(false)}>
          <Thrower shouldThrow={shouldThrow} />
        </WhiteboardErrorBoundary>
      );
    }

    render(<TestApp />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /recover/i });
    fireEvent.click(button);

    expect(screen.getByTestId("recovered")).toBeInTheDocument();
    expect(screen.getByText("Recovered")).toBeInTheDocument();
  });

  it("works without onRecover prop", () => {
    render(
      <WhiteboardErrorBoundary>
        <Thrower shouldThrow={true} />
      </WhiteboardErrorBoundary>
    );

    const button = screen.getByRole("button", { name: /recover/i });
    expect(() => fireEvent.click(button)).not.toThrow();
  });
});
