export interface SessionLike {
  user?: {
    id?: string;
    role?: string;
  } | null;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Admin authorization required");
    this.name = "UnauthorizedError";
  }
}

/**
 * Server-side admin gate. The client never supplies role — this always
 * reads the role attached to the session by buildAuthConfig's callback,
 * which itself reads from the database on every session check.
 */
export function requireAdmin(session: SessionLike | null): asserts session is {
  user: { id: string; role: "admin" };
} {
  if (!session?.user?.id || session.user.role !== "admin") {
    throw new UnauthorizedError();
  }
}
