import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders its label and responds to clicks", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Start workout</Button>);

    const button = screen.getByRole("button", { name: "Start workout" });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disables interaction when disabled", () => {
    render(<Button disabled>Start workout</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders the outline variant with a transparent background", () => {
    render(<Button variant="outline">View exercises</Button>);
    expect(screen.getByRole("button", { name: "View exercises" })).toHaveClass("bg-transparent");
  });
});
