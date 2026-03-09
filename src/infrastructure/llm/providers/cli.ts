import { spawn } from "child_process";
import type { LLMProvider, LLMOptions } from "../types";

function parseStructuredOutput(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed) return trimmed;

  const parsed = JSON.parse(trimmed) as {
    type?: string;
    result?: unknown;
    structured_output?: unknown;
  };

  if (parsed && typeof parsed === "object" && "structured_output" in parsed) {
    if (parsed.structured_output != null) {
      return JSON.stringify(parsed.structured_output);
    }

    if (typeof parsed.result === "string" && parsed.result.trim()) {
      return parsed.result.trim();
    }

    throw new Error("CLI structured output missing from JSON response");
  }

  if (
    parsed
    && typeof parsed === "object"
    && parsed.type === "result"
    && typeof parsed.result === "string"
    && parsed.result.trim()
  ) {
    return parsed.result.trim();
  }

  return trimmed;
}

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
    if (options?.jsonSchema) {
      args.push("--output-format", "json");
      args.push("--json-schema", JSON.stringify(options.jsonSchema));
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
        try {
          resolve(options?.jsonSchema ? parseStructuredOutput(stdout) : stdout.trim());
        } catch (error) {
          reject(
            error instanceof Error
              ? error
              : new Error("CLI structured output parsing failed")
          );
        }
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }
}
