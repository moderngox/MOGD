import { z } from "zod";

/**
 * Builds a strict env accessor from a Zod shape. Throws immediately with a
 * readable list of missing/invalid keys instead of failing later at first use.
 */
export function loadEnv<Shape extends z.ZodRawShape>(
  shape: Shape,
  source: Record<string, string | undefined> = process.env,
): z.infer<z.ZodObject<Shape>> {
  const schema = z.object(shape);
  const result = schema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return result.data;
}
