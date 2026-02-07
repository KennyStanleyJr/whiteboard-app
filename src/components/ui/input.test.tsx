import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input data-testid="input" />);
    const input = screen.getByTestId("input");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("accepts and displays value", () => {
    render(<Input value="hello" onChange={() => {}} data-testid="input" />);
    const input = screen.getByTestId("input");
    expect(input).toHaveValue("hello");
  });

  it("supports placeholder", () => {
    render(<Input placeholder="Enter text" data-testid="input" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("supports type", () => {
    render(<Input type="password" data-testid="input" />);
    const input = screen.getByTestId("input");
    expect(input).toHaveAttribute("type", "password");
  });

  it("is disabled when disabled prop is true", () => {
    render(<Input disabled data-testid="input" />);
    expect(screen.getByTestId("input")).toBeDisabled();
  });

  it("calls onChange when user types", () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} data-testid="input" />);
    const input = screen.getByTestId("input");
    fireEvent.change(input, { target: { value: "a" } });
    expect(onChange).toHaveBeenCalled();
  });
});
