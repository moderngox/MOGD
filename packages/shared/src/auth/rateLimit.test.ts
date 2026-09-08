import { describe, expect, it } from "vitest";
import { isLockedOut, recordFailedAttempt } from "./rateLimit";

describe("rateLimit", () => {
  it("is not locked out with no recorded failures", () => {
    expect(isLockedOut("fresh-key@example.com")).toBe(false);
  });

  it("does not lock out after fewer than 5 failures", () => {
    const key = "under-limit@example.com";
    for (let i = 0; i < 4; i++) recordFailedAttempt(key);
    expect(isLockedOut(key)).toBe(false);
  });

  it("locks out after 5 recorded failures", () => {
    const key = "over-limit@example.com";
    for (let i = 0; i < 5; i++) recordFailedAttempt(key);
    expect(isLockedOut(key)).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const a = "user-a@example.com";
    const b = "user-b@example.com";
    for (let i = 0; i < 5; i++) recordFailedAttempt(a);
    expect(isLockedOut(a)).toBe(true);
    expect(isLockedOut(b)).toBe(false);
  });
});
