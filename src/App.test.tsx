import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders whiteboard header", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /whiteboard/i })).toBeInTheDocument();
  });

  it("renders whiteboard canvas", () => {
    const { container } = render(<App />);
    const canvas = container.querySelector(".app");
    expect(canvas).toBeInTheDocument();
  });
});
