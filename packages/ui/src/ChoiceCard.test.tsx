import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChoiceCard } from "./ChoiceCard";

describe("ChoiceCard", () => {
  it("renders its label and calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(<ChoiceCard label="Fat loss" selected={false} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Fat loss" }));

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("reflects selected state via aria-checked", () => {
    render(<ChoiceCard label="Fat loss" selected role="radio" onSelect={() => {}} />);
    expect(screen.getByRole("radio", { name: "Fat loss" })).toHaveAttribute("aria-checked", "true");
  });

  it("does not call onSelect when disabled", () => {
    const onSelect = vi.fn();
    render(<ChoiceCard label="Fat loss" selected={false} onSelect={onSelect} disabled />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Fat loss" }));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
