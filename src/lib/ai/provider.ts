import { AIProvider, GenerateOptions } from "./types";
import { AnthropicProvider } from "./anthropic-provider";
import { CLIProvider } from "./cli-provider";

export function getAIProvider(): AIProvider {
  const providerType = process.env.AI_PROVIDER || "api";

  if (providerType === "cli") {
    return new CLIProvider(process.env.CLAUDE_CLI_PATH || "claude");
  }

  return new AnthropicProvider(
    process.env.ANTHROPIC_API_KEY || "",
    process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514"
  );
}
