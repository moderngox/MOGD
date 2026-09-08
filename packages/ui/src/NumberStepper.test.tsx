import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NumberStepper } from "./NumberStepper";

describe("NumberStepper", () => {
  it("increments and decrements by step, clamped to min/max", () => {
    const onChange = vi.fn();
    render(<NumberStepper label="Age" value={30} onChange={onChange} min={16} max={80} />);

    fireEvent.click(screen.getByRole("button", { name: "Increase Age" }));
    expect(onChange).toHaveBeenCalledWith(31);

    fireEvent.click(screen.getByRole("button", { name: "Decrease Age" }));
    expect(onChange).toHaveBeenCalledWith(29);
  });

  it("disables the decrease button at the minimum", () => {
    const onChange = vi.fn();
    render(<NumberStepper label="Age" value={16} onChange={onChange} min={16} max={80} />);
    expect(screen.getByRole("button", { name: "Decrease Age" })).toBeDisabled();
  });

  it("disables the increase button at the maximum", () => {
    const onChange = vi.fn();
    render(<NumberStepper label="Age" value={80} onChange={onChange} min={16} max={80} />);
    expect(screen.getByRole("button", { name: "Increase Age" })).toBeDisabled();
  });
});
