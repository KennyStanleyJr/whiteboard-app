import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ThemeProvider } from "./ThemeProvider";
import { useTheme } from "./themeContext";

function ThemedChild(): JSX.Element {
  const theme = useTheme();
  return <span data-testid="theme">{theme}</span>;
}

describe("ThemeProvider", () => {
  it("renders children", () => {
    render(
      <ThemeProvider theme="light">
        <span data-testid="child">Content</span>
      </ThemeProvider>
    );
    expect(screen.getByTestId("child")).toHaveTextContent("Content");
  });

  it("provides light theme to descendants", () => {
    render(
      <ThemeProvider theme="light">
        <ThemedChild />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });

  it("provides dark theme to descendants", () => {
    render(
      <ThemeProvider theme="dark">
        <ThemedChild />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("overrides outer theme when nested", () => {
    render(
      <ThemeProvider theme="light">
        <ThemedChild />
        <ThemeProvider theme="dark">
          <ThemedChild />
        </ThemeProvider>
      </ThemeProvider>
    );
    const themes = screen.getAllByTestId("theme");
    expect(themes[0]).toHaveTextContent("light");
    expect(themes[1]).toHaveTextContent("dark");
  });
});
