import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required, e.g. file:./local.db or libsql://<db>.turso.io"),
  DATABASE_AUTH_TOKEN: z.string().optional(),
});

export function loadDbEnv(source: Record<string, string | undefined> = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid database environment configuration:\n${issues}`);
  }
  return result.data;
}
