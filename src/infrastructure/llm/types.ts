export interface LLMProvider {
  generate(prompt: string, options?: LLMOptions): Promise<string>;
}

export interface LLMOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
}
