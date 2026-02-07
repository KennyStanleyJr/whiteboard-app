import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  PortalContainerProvider,
  usePortalContainer,
  usePortalContainerRef,
} from "./PortalContainerContext";

function Consumer(): JSX.Element {
  const container = usePortalContainer();
  return (
    <span data-testid="container">
      {container ? "has-container" : "no-container"}
    </span>
  );
}

describe("PortalContainerContext", () => {
  describe("usePortalContainer", () => {
    it("returns null when no provider", () => {
      render(<Consumer />);
      expect(screen.getByTestId("container")).toHaveTextContent("no-container");
    });

    it("returns null when provider has null container", () => {
      render(
        <PortalContainerProvider container={null}>
          <Consumer />
        </PortalContainerProvider>
      );
      expect(screen.getByTestId("container")).toHaveTextContent("no-container");
    });

    it("returns container element when provided", () => {
      const div = document.createElement("div");
      div.id = "portal-root";
      render(
        <PortalContainerProvider container={div}>
          <Consumer />
        </PortalContainerProvider>
      );
      expect(screen.getByTestId("container")).toHaveTextContent("has-container");
    });
  });

  describe("PortalContainerProvider", () => {
    it("renders children", () => {
      const div = document.createElement("div");
      render(
        <PortalContainerProvider container={div}>
          <span data-testid="child">Child</span>
        </PortalContainerProvider>
      );
      expect(screen.getByTestId("child")).toHaveTextContent("Child");
    });
  });

  describe("usePortalContainerRef", () => {
    it("sets container when ref target is mounted", async () => {
      function TestComponent(): JSX.Element {
        const [ref, elem] = usePortalContainerRef();
        return (
          <div>
            <div ref={ref} data-testid="target" />
            <span data-testid="status">
              {elem != null ? "mounted" : "not-mounted"}
            </span>
          </div>
        );
      }

      render(<TestComponent />);
      await screen.findByText("mounted");
      expect(screen.getByTestId("status")).toHaveTextContent("mounted");
      expect(screen.getByTestId("target")).toBeInTheDocument();
    });

    it("clears container when ref target is unmounted", async () => {
      function TestComponent({
        show,
      }: {
        show: boolean;
      }): JSX.Element {
        const [ref, elem] = usePortalContainerRef();
        return (
          <div>
            {show && <div ref={ref} data-testid="target" />}
            <span data-testid="status">
              {elem != null ? "mounted" : "not-mounted"}
            </span>
          </div>
        );
      }

      const { rerender } = render(<TestComponent show={true} />);
      await screen.findByText("mounted");

      rerender(<TestComponent show={false} />);
      await screen.findByText("not-mounted");
      expect(screen.getByTestId("status")).toHaveTextContent("not-mounted");
    });
  });
});
