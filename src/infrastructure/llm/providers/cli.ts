import { spawn } from "child_process";
import type { LLMProvider, LLMOptions } from "../types";

export class CLIProvider implements LLMProvider {
  private cliPath: string;

  constructor(cliPath: string) {
    this.cliPath = cliPath;
  }

  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    const args = [
      "--print",
      // Isolation: ignore project/user settings, disable tools, no session
      "--setting-sources", "",
      "--tools", "",
      "--no-session-persistence",
    ];

    if (options?.system) {
      args.push("--system-prompt", options.system);
    }

    const env = { ...process.env };
    delete env.CLAUDECODE;

    // Pass prompt via stdin to avoid shell arg length limits
    return new Promise((resolve, reject) => {
      const child = spawn(this.cliPath, args, {
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

      child.on("error", (err) => reject(new Error(`CLI spawn error: ${err.message}`)));
      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`CLI error (exit ${code}): ${stderr || stdout}`));
          return;
        }
        resolve(stdout.trim());
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }
}
