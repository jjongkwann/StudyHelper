import { basename, join, isAbsolute } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

import type { ImportState, ChapterPlan, ConceptPlan } from "@/core/types";
import { scanMarkdownFiles, parseMarkdownFile } from "@/infrastructure/parser/markdown";
import { llmGateway } from "@/infrastructure/llm/gateway";
import { organizeChaptersPrompt, analyzeConceptsPrompt, SYSTEM_PROMPT } from "@/infrastructure/llm/prompts";
import { chapterOrganizationSchema, conceptAnalysisSchema } from "@/infrastructure/llm/schemas";
import { chapterRepo } from "@/infrastructure/db/repositories/chapter";

// -- Step: validateInput --

export async function validateInput(state: ImportState): Promise<ImportState> {
  const basePath = isAbsolute(state.contentPath)
    ? state.contentPath
    : join(process.cwd(), "content", state.contentPath);

  if (!existsSync(basePath)) {
    throw new Error(`콘텐츠 경로가 존재하지 않습니다: ${basePath}`);
  }

  return { ...state, basePath };
}

// -- Step: scanFiles --

export async function scanFiles(state: ImportState): Promise<ImportState> {
  const mdFiles = await scanMarkdownFiles(state.basePath);
  if (mdFiles.length === 0) {
    throw new Error("콘텐츠 경로에 마크다운 파일이 없습니다");
  }

  const syllabusFile = mdFiles.find(
    (f) => basename(f).startsWith("_목차") || basename(f).startsWith("_index")
  ) ?? null;

  const contentFiles = mdFiles.filter((f) => !basename(f).startsWith("_"));

  return { ...state, mdFiles, syllabusFile, contentFiles };
}

// -- Step: planChapters --

export async function planChapters(state: ImportState): Promise<ImportState> {
  const fileNames = state.contentFiles.map((f) => basename(f));

  let chapters: ChapterPlan[];
  try {
    const syllabusContent = state.syllabusFile
      ? await readFile(state.syllabusFile, "utf-8")
      : `사용 가능한 학습 파일: ${fileNames.map((f) => f.replace(/\.md$/, "")).join(", ")}`;

    const result = await llmGateway.generateAndValidate(
      organizeChaptersPrompt(syllabusContent, fileNames),
      { system: SYSTEM_PROMPT, schema: chapterOrganizationSchema, retries: 1 }
    );
    chapters = result.chapters.filter((c) => c.files.length > 0);
  } catch (e) {
    console.warn("AI 챕터 구성 실패, 파일 기반 폴백:", e);
    chapters = fileNames.map((f, i) => ({
      title: f.replace(/\.md$/, ""),
      description: "",
      order: i + 1,
      files: [f],
    }));
  }

  if (chapters.length === 0) {
    throw new Error("챕터를 구성할 수 없습니다");
  }

  return { ...state, chapters };
}

// -- Step: analyzeChapter (runs per chapter) --

export async function analyzeChapter(state: ImportState): Promise<ImportState> {
  const chapter = state.chapters[state.currentChapterIndex];
  if (!chapter) return state;

  const chapterFiles = chapter.files
    .map((fileName) => state.contentFiles.find((f) => basename(f) === fileName))
    .filter((f): f is string => !!f);

  if (chapterFiles.length === 0) {
    return {
      ...state,
      chapterConcepts: { ...state.chapterConcepts, [chapter.order]: [] },
    };
  }

  const parsedFiles = await Promise.all(
    chapterFiles.map((f) => parseMarkdownFile(f, state.basePath))
  );

  const combinedContent = parsedFiles.map((p) => p.rawContent).join("\n\n---\n\n");

  let concepts: ConceptPlan[];
  try {
    const result = await llmGateway.generateAndValidate(
      analyzeConceptsPrompt(chapter.title, combinedContent),
      { system: SYSTEM_PROMPT, schema: conceptAnalysisSchema, retries: 1 }
    );
    concepts = result.concepts;
  } catch (e) {
    console.warn(`AI 개념 분석 실패 (${chapter.title}), 헤딩 기반 폴백:`, e);
    concepts = parsedFiles.flatMap((p, fi) =>
      p.sections.map((s, si) => ({
        title: s.title,
        content: s.content,
        bloomLevel: 1,
        order: fi * 100 + si + 1,
      }))
    );
  }

  return {
    ...state,
    chapterConcepts: { ...state.chapterConcepts, [chapter.order]: concepts },
  };
}

// -- Step: persistChapter (runs per chapter, idempotent via persistedChapters) --

export async function persistChapter(state: ImportState): Promise<ImportState> {
  const chapter = state.chapters[state.currentChapterIndex];
  if (!chapter) return state;

  // Idempotency: skip if already persisted
  if (state.persistedChapters.includes(chapter.order)) {
    return state;
  }

  const concepts = state.chapterConcepts[chapter.order] || [];
  const chapterFiles = chapter.files
    .map((fileName) => state.contentFiles.find((f) => basename(f) === fileName))
    .filter((f): f is string => !!f);

  if (chapterFiles.length === 0) {
    return { ...state, persistedChapters: [...state.persistedChapters, chapter.order] };
  }

  const parsedFiles = await Promise.all(
    chapterFiles.map((f) => parseMarkdownFile(f, state.basePath))
  );

  await chapterRepo.createWithConcepts({
    projectId: state.projectId,
    title: chapter.title,
    order: chapter.order,
    sourceFile: chapter.files.join(", "),
    contentHash: parsedFiles.map((p) => p.contentHash).join(","),
    rawContent: parsedFiles.map((p) => p.rawContent).join("\n\n---\n\n"),
    concepts,
  });

  return { ...state, persistedChapters: [...state.persistedChapters, chapter.order] };
}
