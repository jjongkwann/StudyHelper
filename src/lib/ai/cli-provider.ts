import { execFile } from "child_process";
import { AIProvider, GenerateOptions } from "./types";

export class CLIProvider implements AIProvider {
  private cliPath: string;

  constructor(cliPath: string) {
    this.cliPath = cliPath;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const args = ["--print"];
    if (options?.system) {
      args.push("--system", options.system);
    }
    if (options?.maxTokens) {
      args.push("--max-tokens", String(options.maxTokens));
    }
    args.push(prompt);

    return new Promise((resolve, reject) => {
      execFile(this.cliPath, args, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`CLI error: ${stderr || error.message}`));
          return;
        }
        resolve(stdout.trim());
      });
    });
  }
}
