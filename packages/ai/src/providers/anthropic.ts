import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  StructuredOutputValidationError,
  type StructuredGenerationProvider,
  type StructuredGenerationRequest,
  type StructuredGenerationResult,
} from "../provider";

/**
 * Anthropic adapter for the provider-neutral contract. Uses forced tool-use
 * so the model must return an argument object shaped like the caller's Zod
 * schema, then validates that object with the schema itself before ever
 * returning it — an invalid tool call is rejected here, not coerced.
 */
export class AnthropicStructuredProvider implements StructuredGenerationProvider {
  readonly providerName = "anthropic";
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly modelName: string = "claude-sonnet-5",
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async generateStructured<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<StructuredGenerationResult<T>> {
    const startedAt = Date.now();

    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 4096,
      system: request.system,
      messages: [{ role: "user", content: request.prompt }],
      tools: [
        {
          name: request.schemaName,
          description: `Return output matching the ${request.schemaName} schema.`,
          // No `name` argument: that mode wraps the output as
          // { $ref, definitions } rather than a flat schema, and Anthropic's
          // tool input_schema requires a flat { type: "object", properties }.
          input_schema: zodToJsonSchema(request.schema) as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: request.schemaName },
    });

    const latencyMs = Date.now() - startedAt;

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUse) {
      throw new StructuredOutputValidationError(
        request.schemaName,
        "model response contained no tool_use block",
      );
    }

    const parsed = request.schema.safeParse(toolUse.input);
    if (!parsed.success) {
      throw new StructuredOutputValidationError(
        request.schemaName,
        parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
      );
    }

    return {
      data: parsed.data,
      latencyMs,
      provider: this.providerName,
      model: this.modelName,
    };
  }
}
