import { execFile } from "child_process";
import { AIProvider, GenerateOptions } from "./types";

export class CLIProvider implements AIProvider {
  private cliPath: string;

  constructor(cliPath: string) {
    this.cliPath = cliPath;
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const args = ["--print"];

    // system prompt는 본문에 합침
    const fullPrompt = options?.system
      ? `[시스템 지시]: ${options.system}\n\n${prompt}`
      : prompt;
    args.push(fullPrompt);

    // CLAUDECODE 환경변수를 제거하여 중첩 실행 제한 우회
    const env = { ...process.env };
    delete env.CLAUDECODE;

    return new Promise((resolve, reject) => {
      execFile(this.cliPath, args, { maxBuffer: 1024 * 1024 * 10, env }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`CLI error: ${stderr || error.message}`));
          return;
        }
        resolve(stdout.trim());
      });
    });
  }
}
