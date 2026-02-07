import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { WhiteboardErrorBoundary } from "./WhiteboardErrorBoundary";

function Thrower({ shouldThrow }: { shouldThrow: boolean }): JSX.Element {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <span data-testid="recovered">Recovered</span>;
}

/**
 * React logs to console when an error boundary catches (see facebook/react#11098).
 * The recommended approach is to spy on console.error in tests that intentionally throw.
 * We filter only the known React + our-boundary message patterns; all other errors still log.
 */
function suppressExpectedErrorBoundaryLogs(): () => void {
  const original = console.error;
  const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const first = args[0];
    const str = typeof first === "string" ? first : String(first);
    if (
      str.includes("WhiteboardErrorBoundary") ||
      str.includes("The above error occurred") ||
      str.includes("Test error")
    ) {
      return;
    }
    original.apply(console, args);
  });
  return () => {
    spy.mockRestore();
  };
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
    const restore = suppressExpectedErrorBoundaryLogs();
    try {
      render(
        <WhiteboardErrorBoundary>
          <Thrower shouldThrow={true} />
        </WhiteboardErrorBoundary>
      );
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /recover/i })).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("calls onRecover when recover button is clicked", () => {
    const restore = suppressExpectedErrorBoundaryLogs();
    try {
      const onRecover = vi.fn();
      render(
        <WhiteboardErrorBoundary onRecover={onRecover}>
          <Thrower shouldThrow={true} />
        </WhiteboardErrorBoundary>
      );
      const button = screen.getByRole("button", { name: /recover/i });
      fireEvent.click(button);
      expect(onRecover).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });

  it("re-renders children after recover when child no longer throws", () => {
    const restore = suppressExpectedErrorBoundaryLogs();
    try {
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
    } finally {
      restore();
    }
  });

  it("works without onRecover prop", () => {
    const restore = suppressExpectedErrorBoundaryLogs();
    try {
      render(
        <WhiteboardErrorBoundary>
          <Thrower shouldThrow={true} />
        </WhiteboardErrorBoundary>
      );
      const button = screen.getByRole("button", { name: /recover/i });
      expect(() => fireEvent.click(button)).not.toThrow();
    } finally {
      restore();
    }
  });
});
