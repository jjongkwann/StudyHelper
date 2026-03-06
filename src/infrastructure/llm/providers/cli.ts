import { execFile } from "child_process";
import type { LLMProvider, LLMOptions } from "../types";

export class CLIProvider implements LLMProvider {
  private cliPath: string;

  constructor(cliPath: string) {
    this.cliPath = cliPath;
  }

  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    const args = ["--print"];

    const fullPrompt = options?.system
      ? `[시스템 지시]: ${options.system}\n\n${prompt}`
      : prompt;
    args.push(fullPrompt);

    const env = { ...process.env };
    delete env.CLAUDECODE;

    return new Promise((resolve, reject) => {
      execFile(
        this.cliPath,
        args,
        { maxBuffer: 1024 * 1024 * 10, env },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`CLI error: ${stderr || error.message}`));
            return;
          }
          resolve(stdout.trim());
        }
      );
    });
  }
}
