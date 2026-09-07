import type { ZodType } from "zod";

/**
 * Provider-neutral structured-generation contract. Domain code depends only
 * on this interface (docs/AI_AND_SAFETY.md "Structured contracts") — vendor
 * SDKs and model-specific behavior stay behind an adapter that implements
 * it. No feature-specific prompt or schema lives in this package yet; M0
 * only establishes the contract and run-record foundation.
 */
export interface StructuredGenerationRequest<T> {
  /** What this call is for, e.g. "assessment_interpretation". Logged verbatim. */
  purpose: string;
  /** The Zod schema the raw model output must validate against. */
  schema: ZodType<T>;
  /** Stable name for the schema, used as the tool/function name and in logs. */
  schemaName: string;
  /** Version of that schema. Bump whenever its shape changes. */
  schemaVersion: string;
  /** Version of the prompt text/strategy being used. Bump on meaningful edits. */
  promptVersion: string;
  system?: string;
  prompt: string;
  userId?: string;
}

export interface StructuredGenerationResult<T> {
  data: T;
  latencyMs: number;
  provider: string;
  model: string;
  estimatedCostUsd?: number;
}

export class StructuredOutputValidationError extends Error {
  constructor(
    public readonly schemaName: string,
    public readonly issues: string,
  ) {
    super(`Structured output for "${schemaName}" failed validation: ${issues}`);
    this.name = "StructuredOutputValidationError";
  }
}

export interface StructuredGenerationProvider {
  readonly providerName: string;
  readonly modelName: string;
  generateStructured<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<StructuredGenerationResult<T>>;
}
