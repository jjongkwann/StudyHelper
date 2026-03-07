import { basename, join, isAbsolute } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

import type { ImportState, ChapterPlan, ConceptPlan, TopicPlan, FileAssignment } from "@/core/types";
import { scanMarkdownFiles, parseMarkdownFile } from "@/infrastructure/parser/markdown";
import { llmGateway } from "@/infrastructure/llm/gateway";
import {
  extractTopicsPrompt,
  classifyFilesPrompt,
  buildChaptersPrompt,
  analyzeConceptsPrompt,
  buildFileBlocks,
  structureConceptsPrompt,
  generateConceptsPrompt,
  SYSTEM_PROMPT,
} from "@/infrastructure/llm/prompts";
import {
  extractTopicsSchema,
  classifyFilesSchema,
  chapterOrganizationSchema,
  conceptAnalysisSchema,
  conceptOutlineSchema,
} from "@/infrastructure/llm/schemas";
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

// ---------------------------------------------------------------------------
// planChapters chain: 4 steps (extractTopics → classifyFiles → buildChapters → validatePlan)
// ---------------------------------------------------------------------------

/** Extract headings from syllabus markdown (code-only, no LLM) */
function extractHeadings(markdown: string): string {
  return markdown
    .split("\n")
    .filter((line) => /^#{1,3}\s/.test(line))
    .join("\n");
}

// -- Chain Step 1: extractTopics --

export async function extractTopics(state: ImportState): Promise<ImportState> {
  const fileNames = state.contentFiles.map((f) => basename(f));

  if (!state.syllabusFile) {
    // No syllabus → create one topic per file as fallback
    const topics: TopicPlan[] = [{
      title: "학습 자료",
      keywords: fileNames.map((f) => f.replace(/\.md$/, "")),
      order: 1,
    }];
    return { ...state, topics };
  }

  try {
    const syllabusRaw = await readFile(state.syllabusFile, "utf-8");
    const headings = extractHeadings(syllabusRaw);

    const result = await llmGateway.generateAndValidate(
      extractTopicsPrompt(headings),
      { system: SYSTEM_PROMPT, schema: extractTopicsSchema, retries: 1 }
    );
    return { ...state, topics: result.topics };
  } catch (e) {
    console.warn("extractTopics 실패, 단일 주제 폴백:", e);
    return {
      ...state,
      topics: [{ title: "학습 자료", keywords: fileNames.map((f) => f.replace(/\.md$/, "")), order: 1 }],
    };
  }
}

// -- Chain Step 2: classifyFiles --

export async function classifyFiles(state: ImportState): Promise<ImportState> {
  const fileNames = state.contentFiles.map((f) => basename(f));

  if (state.topics.length <= 1) {
    // Single topic → all files belong to it
    const assignments: FileAssignment[] = fileNames.map((f) => ({
      file: f,
      topic: state.topics[0]?.title ?? "학습 자료",
    }));
    return { ...state, fileAssignments: assignments };
  }

  try {
    const topicsJson = JSON.stringify(state.topics, null, 2);
    const result = await llmGateway.generateAndValidate(
      classifyFilesPrompt(topicsJson, fileNames),
      { system: SYSTEM_PROMPT, schema: classifyFilesSchema, retries: 1 }
    );
    return { ...state, fileAssignments: result.assignments };
  } catch (e) {
    console.warn("classifyFiles 실패, 첫 번째 주제에 전부 배정:", e);
    const assignments: FileAssignment[] = fileNames.map((f) => ({
      file: f,
      topic: state.topics[0]?.title ?? "학습 자료",
    }));
    return { ...state, fileAssignments: assignments };
  }
}

// -- Chain Step 3: buildChapters --

export async function buildChapters(state: ImportState): Promise<ImportState> {
  const fileNames = state.contentFiles.map((f) => basename(f));

  try {
    const topicsJson = JSON.stringify(state.topics, null, 2);
    const assignmentsJson = JSON.stringify(state.fileAssignments, null, 2);

    const result = await llmGateway.generateAndValidate(
      buildChaptersPrompt(topicsJson, assignmentsJson),
      { system: SYSTEM_PROMPT, schema: chapterOrganizationSchema, retries: 1 }
    );

    const chapters = result.chapters.filter((c) => c.files.length > 0);
    if (chapters.length === 0) throw new Error("빈 챕터 결과");
    return { ...state, chapters };
  } catch (e) {
    console.warn("buildChapters 실패, 파일 기반 폴백:", e);
    const chapters: ChapterPlan[] = fileNames.map((f, i) => ({
      title: f.replace(/\.md$/, ""),
      description: "",
      order: i + 1,
      files: [f],
    }));
    return { ...state, chapters };
  }
}

// -- Chain Step 4: validatePlan (code-only, no LLM) --

export async function validatePlan(state: ImportState): Promise<ImportState> {
  const fileNames = new Set(state.contentFiles.map((f) => basename(f)));
  const assignedFiles = new Set<string>();

  const fixedChapters = state.chapters.map((ch) => ({
    ...ch,
    // Remove files that don't actually exist
    files: ch.files.filter((f) => {
      if (!fileNames.has(f)) {
        console.warn(`validatePlan: 존재하지 않는 파일 제거: ${f}`);
        return false;
      }
      assignedFiles.add(f);
      return true;
    }),
  })).filter((ch) => ch.files.length > 0);

  // Find unassigned files and add them to the last chapter or create a new one
  const unassigned = [...fileNames].filter((f) => !assignedFiles.has(f));
  if (unassigned.length > 0) {
    console.warn(`validatePlan: 미배정 파일 ${unassigned.length}개 → 기타 챕터에 추가`);
    const maxOrder = Math.max(0, ...fixedChapters.map((c) => c.order));
    fixedChapters.push({
      title: "기타 학습 자료",
      description: "자동 분류되지 않은 학습 파일",
      order: maxOrder + 1,
      files: unassigned,
    });
  }

  if (fixedChapters.length === 0) {
    throw new Error("유효한 챕터가 없습니다");
  }

  return { ...state, chapters: fixedChapters };
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

  let concepts: ConceptPlan[];

  // Single file → use existing single-shot prompt (no need for 2-step chain)
  if (parsedFiles.length === 1) {
    concepts = await analyzeChapterSingleFile(chapter, parsedFiles);
  } else {
    concepts = await analyzeChapterMultiFile(chapter, parsedFiles);
  }

  return {
    ...state,
    chapterConcepts: { ...state.chapterConcepts, [chapter.order]: concepts },
  };
}

/** Single-file chapter: use existing analyzeConceptsPrompt (1 LLM call) */
async function analyzeChapterSingleFile(
  chapter: ChapterPlan,
  parsedFiles: Awaited<ReturnType<typeof parseMarkdownFile>>[]
): Promise<ConceptPlan[]> {
  try {
    const result = await llmGateway.generateAndValidate(
      analyzeConceptsPrompt(chapter.title, parsedFiles[0].rawContent),
      { system: SYSTEM_PROMPT, schema: conceptAnalysisSchema, retries: 1 }
    );
    return result.concepts;
  } catch (e) {
    console.warn(`AI 개념 분석 실패 (${chapter.title}), 헤딩 기반 폴백:`, e);
    return headingFallback(parsedFiles);
  }
}

/** Multi-file chapter: 2-step prompt chain with fallback cascade */
async function analyzeChapterMultiFile(
  chapter: ChapterPlan,
  parsedFiles: Awaited<ReturnType<typeof parseMarkdownFile>>[]
): Promise<ConceptPlan[]> {
  const files = parsedFiles.map((p, i) => ({
    name: chapter.files[i] ?? `file${i}.md`,
    content: p.rawContent,
  }));
  const fileBlocks = buildFileBlocks(files);

  // Step 1: Structure analysis
  let outline: { fileIndex: number; sectionTitle: string; learningOrder: number; bloomLevel: number; mergeWithPrevious?: boolean }[] | null = null;
  try {
    const step1 = await llmGateway.generateAndValidate(
      structureConceptsPrompt(chapter.title, fileBlocks),
      { system: SYSTEM_PROMPT, schema: conceptOutlineSchema, retries: 1 }
    );
    outline = step1.outline;
  } catch (e) {
    console.warn(`Step 1 구조 분석 실패 (${chapter.title}), 단일 프롬프트 폴백:`, e);
  }

  // Step 1 failed → fallback to single-shot with XML file blocks
  if (!outline) {
    try {
      const result = await llmGateway.generateAndValidate(
        analyzeConceptsPrompt(chapter.title, fileBlocks),
        { system: SYSTEM_PROMPT, schema: conceptAnalysisSchema, retries: 1 }
      );
      return result.concepts;
    } catch (e) {
      console.warn(`단일 프롬프트 폴백도 실패 (${chapter.title}), 헤딩 기반 폴백:`, e);
      return headingFallback(parsedFiles);
    }
  }

  // Step 2: Generate concepts from outline
  try {
    const outlineJson = JSON.stringify(outline, null, 2);
    const step2 = await llmGateway.generateAndValidate(
      generateConceptsPrompt(chapter.title, fileBlocks, outlineJson),
      { system: SYSTEM_PROMPT, schema: conceptAnalysisSchema, retries: 1 }
    );
    return step2.concepts;
  } catch (e) {
    console.warn(`Step 2 개념 생성 실패 (${chapter.title}), outline 기반 코드 생성:`, e);
    // Step 2 failed → build concepts from outline + parsed sections
    return outlineFallback(outline, parsedFiles);
  }
}

/** Fallback: generate concepts from heading structure */
function headingFallback(
  parsedFiles: Awaited<ReturnType<typeof parseMarkdownFile>>[]
): ConceptPlan[] {
  return parsedFiles.flatMap((p, fi) =>
    p.sections.map((s, si) => ({
      title: s.title,
      content: s.content,
      bloomLevel: 1,
      order: fi * 100 + si + 1,
    }))
  );
}

/** Fallback: generate concepts from outline + parsed sections when Step 2 fails */
function outlineFallback(
  outline: { fileIndex: number; sectionTitle: string; learningOrder: number; bloomLevel: number; mergeWithPrevious?: boolean }[],
  parsedFiles: Awaited<ReturnType<typeof parseMarkdownFile>>[]
): ConceptPlan[] {
  const sorted = [...outline].sort((a, b) => a.learningOrder - b.learningOrder);
  const concepts: ConceptPlan[] = [];

  for (const entry of sorted) {
    if (entry.mergeWithPrevious && concepts.length > 0) {
      const prev = concepts[concepts.length - 1];
      const section = findSection(parsedFiles, entry.fileIndex, entry.sectionTitle);
      if (section) {
        prev.content += "\n\n" + section.content;
      }
      continue;
    }

    const section = findSection(parsedFiles, entry.fileIndex, entry.sectionTitle);
    concepts.push({
      title: entry.sectionTitle,
      content: section?.content ?? "",
      bloomLevel: entry.bloomLevel,
      order: entry.learningOrder,
    });
  }

  return concepts;
}

/** Find a section in parsed files by file index and title */
function findSection(
  parsedFiles: Awaited<ReturnType<typeof parseMarkdownFile>>[],
  fileIndex: number,
  sectionTitle: string
): { title: string; content: string } | undefined {
  const file = parsedFiles[fileIndex];
  if (!file) return undefined;
  return file.sections.find((s) => s.title === sectionTitle)
    ?? file.sections.find((s) => s.title.includes(sectionTitle) || sectionTitle.includes(s.title));
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
