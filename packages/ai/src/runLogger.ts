import { createHash } from "crypto";
import { schema, type Database } from "@mogd/db";
import {
  StructuredOutputValidationError,
  type StructuredGenerationProvider,
  type StructuredGenerationRequest,
  type StructuredGenerationResult,
} from "./provider";

function hashInput(request: StructuredGenerationRequest<unknown>): string {
  const hash = createHash("sha256");
  hash.update(request.schemaName);
  hash.update(request.promptVersion);
  hash.update(request.system ?? "");
  hash.update(request.prompt);
  return `sha256:${hash.digest("hex")}`;
}

/**
 * Runs a structured generation call and unconditionally records it to
 * ai_runs — including failures — before returning or rethrowing. A rejected
 * or errored run is never silently dropped, and this function never
 * persists a domain result itself: callers still own validating the result
 * against domain rules (equipment, safety bounds, canonical IDs, etc.)
 * before treating it as accepted state.
 */
export async function runStructuredGeneration<T>(
  db: Database,
  provider: StructuredGenerationProvider,
  request: StructuredGenerationRequest<T>,
): Promise<StructuredGenerationResult<T>> {
  const startedAt = Date.now();
  const inputHash = hashInput(request);

  try {
    const result = await provider.generateStructured(request);

    await db.insert(schema.aiRuns).values({
      userId: request.userId,
      purpose: request.purpose,
      provider: result.provider,
      model: result.model,
      promptVersion: request.promptVersion,
      schemaVersion: request.schemaVersion,
      inputHash,
      validatedOutput: result.data as object,
      validationStatus: "accepted",
      latencyMs: result.latencyMs,
      estimatedCostUsd: result.estimatedCostUsd,
    });

    return result;
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const isValidationError = error instanceof StructuredOutputValidationError;

    await db.insert(schema.aiRuns).values({
      userId: request.userId,
      purpose: request.purpose,
      provider: provider.providerName,
      model: provider.modelName,
      promptVersion: request.promptVersion,
      schemaVersion: request.schemaVersion,
      inputHash,
      validationStatus: isValidationError ? "rejected" : "error",
      errorClassification: isValidationError
        ? "schema_mismatch"
        : error instanceof Error
          ? error.name
          : "unknown_error",
      latencyMs,
    });

    throw error;
  }
}
