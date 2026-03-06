import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMOptions } from "../types";

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens ?? 4096,
      ...(options?.system ? { system: options.system } : {}),
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    return block.type === "text" ? block.text : "";
  }
}
