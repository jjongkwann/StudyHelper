import { createHash } from "crypto";
import { readFile, readdir, stat } from "fs/promises";
import { join, relative } from "path";

export interface ParsedChapter {
  title: string;
  sourceFile: string;
  contentHash: string;
  rawContent: string;
  sections: ParsedSection[];
}

export interface ParsedSection {
  title: string;
  content: string;
  level: number; // heading level (1-6)
  order: number;
}

/** MD 파일을 파싱하여 섹션 단위로 분리 */
export function parseMarkdown(content: string, filePath: string): ParsedChapter {
  const lines = content.split("\n");
  const sections: ParsedSection[] = [];
  let chapterTitle = "";
  let currentSection: ParsedSection | null = null;
  let order = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();

      // 첫 h1을 챕터 제목으로
      if (level === 1 && !chapterTitle) {
        chapterTitle = title;
      }

      // 이전 섹션 저장
      if (currentSection) {
        sections.push(currentSection);
      }

      order++;
      currentSection = {
        title,
        content: "",
        level,
        order,
      };
    } else if (currentSection) {
      currentSection.content += line + "\n";
    }
  }

  // 마지막 섹션 저장
  if (currentSection) {
    sections.push(currentSection);
  }

  // h1이 없으면 파일명에서 추출
  if (!chapterTitle) {
    const fileName = filePath.split("/").pop() || "";
    chapterTitle = fileName.replace(/\.md$/, "");
  }

  // 각 섹션 content trim
  for (const section of sections) {
    section.content = section.content.trim();
  }

  return {
    title: chapterTitle,
    sourceFile: filePath,
    contentHash: createHash("md5").update(content).digest("hex"),
    rawContent: content,
    sections: sections.filter((s) => s.content.length > 0),
  };
}

/** 디렉토리를 재귀적으로 스캔하여 모든 .md 파일 경로를 반환 */
export async function scanMarkdownFiles(dirPath: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dirPath);

    for (const entry of entries) {
      if (entry.startsWith(".")) continue;

      const fullPath = join(dirPath, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        const subFiles = await scanMarkdownFiles(fullPath);
        results.push(...subFiles);
      } else if (entry.endsWith(".md")) {
        // "1. xxx.md" 같은 인덱스/목차 파일 제외
        if (/^\d+\.\s/.test(entry)) continue;
        results.push(fullPath);
      }
    }
  } catch {
    // 디렉토리가 없으면 빈 배열 반환
  }

  return results.sort();
}

/** MD 파일을 읽고 파싱 */
export async function parseMarkdownFile(filePath: string, basePath: string): Promise<ParsedChapter> {
  const content = await readFile(filePath, "utf-8");
  const relativePath = relative(basePath, filePath);
  return parseMarkdown(content, relativePath);
}
