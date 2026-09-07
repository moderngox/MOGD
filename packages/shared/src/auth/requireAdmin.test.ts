import { describe, expect, it } from "vitest";
import { requireAdmin, UnauthorizedError } from "./requireAdmin";

describe("requireAdmin", () => {
  it("passes for an admin session", () => {
    expect(() => requireAdmin({ user: { id: "u1", role: "admin" } })).not.toThrow();
  });

  it("rejects a non-admin session", () => {
    expect(() => requireAdmin({ user: { id: "u1", role: "user" } })).toThrow(
      UnauthorizedError,
    );
  });

  it("rejects a missing session", () => {
    expect(() => requireAdmin(null)).toThrow(UnauthorizedError);
  });

  it("rejects a session with no role claim", () => {
    expect(() => requireAdmin({ user: { id: "u1" } })).toThrow(UnauthorizedError);
  });
});
