import { z } from "zod";
import type { LLMProvider, LLMOptions } from "./types";
import { AnthropicProvider } from "./providers/anthropic";
import { CLIProvider } from "./providers/cli";

function extractBalancedJson(text: string): string | null {
  const start = text.search(/[\[{]/);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index++) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

/** Strip code fences and parse JSON */
export function safeParseJSON(text: string): unknown {
  const cleaned = text
    .replace(/```json\s*\n?/g, "")
    .replace(/```\s*$/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const extracted = extractBalancedJson(cleaned);
    if (!extracted) {
      throw new Error("No complete JSON object found in LLM response");
    }
    return JSON.parse(extracted);
  }
}

interface GenerateAndValidateOptions<T> extends LLMOptions {
  schema: z.ZodType<T>;
  /** Max retry attempts on parse/validation failure (default 1) */
  retries?: number;
}

let _provider: LLMProvider | null = null;

function getProvider(): LLMProvider {
  if (_provider) return _provider;

  const providerType = process.env.AI_PROVIDER || "api";
  if (providerType === "cli") {
    _provider = new CLIProvider(process.env.CLAUDE_CLI_PATH || "claude");
  } else {
    _provider = new AnthropicProvider(
      process.env.ANTHROPIC_API_KEY || "",
      process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514"
    );
  }
  return _provider;
}

export const llmGateway = {
  /** Raw text generation */
  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    return getProvider().generate(prompt, options);
  },

  /** Generate, parse JSON, and validate against a Zod schema. Retries on failure. */
  async generateAndValidate<T>(
    prompt: string,
    options: GenerateAndValidateOptions<T>
  ): Promise<T> {
    const { schema, retries = 1, ...llmOpts } = options;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const raw = await getProvider().generate(prompt, {
          ...llmOpts,
          jsonSchema: z.toJSONSchema(schema),
        });
        const parsed = safeParseJSON(raw);
        return schema.parse(parsed);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.warn(
          `LLM parse/validate attempt ${attempt + 1} failed:`,
          lastError.message
        );
      }
    }

    throw new Error(
      `LLM validation failed after ${retries + 1} attempts: ${lastError?.message}`
    );
  },
};
