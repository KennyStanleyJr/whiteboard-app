import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  it("renders as a button with children", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: /click me/i });
    expect(btn).toBeInTheDocument();
    expect(btn.tagName).toBe("BUTTON");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button", { name: /click/i }));
    expect(onClick).toHaveBeenCalled();
  });

  it("applies variant and size via data attributes", () => {
    render(<Button variant="destructive" size="sm">Delete</Button>);
    const btn = screen.getByRole("button", { name: /delete/i });
    expect(btn).toHaveAttribute("data-variant", "destructive");
    expect(btn).toHaveAttribute("data-size", "sm");
  });

  it("supports ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole("button", { name: /ghost/i });
    expect(btn).toHaveAttribute("data-variant", "ghost");
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole("button", { name: /disabled/i });
    expect(btn).toBeDisabled();
  });

  it("supports type submit", () => {
    render(<Button type="submit">Submit</Button>);
    const btn = screen.getByRole("button", { name: /submit/i });
    expect(btn).toHaveAttribute("type", "submit");
  });
});

describe("buttonVariants", () => {
  it("returns a string of class names", () => {
    const result = buttonVariants();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("accepts variant and size options", () => {
    const result = buttonVariants({ variant: "outline", size: "lg" });
    expect(typeof result).toBe("string");
  });
});
