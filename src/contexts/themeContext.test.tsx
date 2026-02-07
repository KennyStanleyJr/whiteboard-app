import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ThemeProvider } from "./ThemeProvider";
import { useTheme } from "./themeContext";

function ThemedLabel(): JSX.Element {
  const theme = useTheme();
  return <span data-testid="theme-value">{theme}</span>;
}

describe("themeContext", () => {
  it("useTheme returns light when no provider", () => {
    render(<ThemedLabel />);
    expect(screen.getByTestId("theme-value")).toHaveTextContent("light");
  });

  it("useTheme returns provider theme when wrapped", () => {
    render(
      <ThemeProvider theme="dark">
        <ThemedLabel />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");
  });

  it("useTheme returns light when provider has light", () => {
    render(
      <ThemeProvider theme="light">
        <ThemedLabel />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme-value")).toHaveTextContent("light");
  });

  it("ThemeProvider renders children", () => {
    render(
      <ThemeProvider theme="dark">
        <span data-testid="child">Child</span>
      </ThemeProvider>
    );
    expect(screen.getByTestId("child")).toHaveTextContent("Child");
  });
});
