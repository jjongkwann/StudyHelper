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
  refineConceptsPrompt,
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

type ParsedFile = Awaited<ReturnType<typeof parseMarkdownFile>>;
type ConceptOutlineEntry = {
  fileIndex: number;
  sectionTitle: string;
  learningOrder: number;
  bloomLevel: number;
  mergeWithPrevious?: boolean;
  sectionRole?: "concept" | "support";
};

const SUPPORT_SECTION_TITLES = new Set([
  "개요",
  "요약",
  "정리",
  "핵심 아이디어",
  "체크리스트",
  "학습 체크리스트",
  "자주 하는 실수",
  "대표 문제 유형",
  "대표 기출 문제",
  "대표 기출 문제 5선",
  "다음 노트",
  "적용 조건",
  "선택 기준",
  "패턴 선택 가이드",
  "핵심 원리",
  "연산 복잡도",
  "시간 복잡도",
  "구성 요소",
  "읽기 과정",
  "백엔드 활용",
  "백엔드 사용 사례",
  "사용하는 시스템",
  "실세계 사용",
  "cap 정리와의 관계",
  "false positive 확률",
  "그리디 vs dp",
  "투 포인터 vs 슬라이딩 윈도우",
  "b+tree vs lsm-tree",
]);

const SUPPORT_SECTION_PREFIXES = [
  "예시:",
  "대표 예시",
  "대표 문제",
  "대표 기출 문제",
  "체크리스트",
  "자주 하는 실수",
  "다음 노트",
  "제출 전 ",
];

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

  concepts = await finalizeConcepts(chapter, parsedFiles, concepts);

  return {
    ...state,
    chapterConcepts: { ...state.chapterConcepts, [chapter.order]: concepts },
  };
}

/** Single-file chapter: use existing analyzeConceptsPrompt (1 LLM call) */
async function analyzeChapterSingleFile(
  chapter: ChapterPlan,
  parsedFiles: ParsedFile[]
): Promise<ConceptPlan[]> {
  try {
    const result = await llmGateway.generateAndValidate(
      analyzeConceptsPrompt(chapter.title, parsedFiles[0].rawContent),
      { system: SYSTEM_PROMPT, schema: conceptAnalysisSchema, retries: 1 }
    );
    return result.concepts;
  } catch (e) {
    console.warn(`AI 개념 분석 실패 (${chapter.title}), 헤딩 기반 폴백:`, e);
    return hierarchicalHeadingFallback(chapter.title, parsedFiles);
  }
}

/** Multi-file chapter: 2-step prompt chain with fallback cascade */
async function analyzeChapterMultiFile(
  chapter: ChapterPlan,
  parsedFiles: ParsedFile[]
): Promise<ConceptPlan[]> {
  const files = parsedFiles.map((p, i) => ({
    name: chapter.files[i] ?? `file${i}.md`,
    content: p.rawContent,
  }));
  const fileBlocks = buildFileBlocks(files);

  // Step 1: Structure analysis
  let outline: ConceptOutlineEntry[] | null = null;
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
      return hierarchicalHeadingFallback(chapter.title, parsedFiles);
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

async function finalizeConcepts(
  chapter: ChapterPlan,
  parsedFiles: ParsedFile[],
  concepts: ConceptPlan[]
): Promise<ConceptPlan[]> {
  const normalizedDraft = normalizeConcepts(chapter.title, concepts);
  const fallback = hierarchicalHeadingFallback(chapter.title, parsedFiles);
  let best = pickBetterConceptSet(normalizedDraft, fallback);

  if (!needsConceptRepair(best)) {
    return best;
  }

  try {
    const sourceContent = buildSourceContentForRepair(chapter, parsedFiles);
    const repaired = await llmGateway.generateAndValidate(
      refineConceptsPrompt(
        chapter.title,
        sourceContent,
        JSON.stringify(normalizedDraft, null, 2)
      ),
      { system: SYSTEM_PROMPT, schema: conceptAnalysisSchema, retries: 1 }
    );
    best = pickBetterConceptSet(best, normalizeConcepts(chapter.title, repaired.concepts));
  } catch (e) {
    console.warn(`concept 정제 실패 (${chapter.title}), 정규화 결과 유지:`, e);
  }

  return pickBetterConceptSet(best, fallback);
}

function buildSourceContentForRepair(
  chapter: ChapterPlan,
  parsedFiles: ParsedFile[]
): string {
  if (parsedFiles.length === 1) {
    return parsedFiles[0]?.rawContent ?? "";
  }

  return buildFileBlocks(
    parsedFiles.map((parsed, index) => ({
      name: chapter.files[index] ?? `file${index}.md`,
      content: parsed.rawContent,
    }))
  );
}

/** Fallback: generate concepts from outline + parsed sections when Step 2 fails */
function outlineFallback(
  outline: ConceptOutlineEntry[],
  parsedFiles: ParsedFile[]
): ConceptPlan[] {
  const sorted = [...outline].sort((a, b) => a.learningOrder - b.learningOrder);
  const concepts: ConceptPlan[] = [];

  for (const entry of sorted) {
    if (entry.mergeWithPrevious && concepts.length > 0) {
      const prev = concepts[concepts.length - 1];
      const section = findSection(parsedFiles, entry.fileIndex, entry.sectionTitle);
      if (section) {
        prev.content = mergeSectionContent(
          prev.content,
          entry.sectionRole === "support" ? section.title : "",
          section.content
        );
      }
      continue;
    }

    const section = findSection(parsedFiles, entry.fileIndex, entry.sectionTitle);
    concepts.push({
      title: normalizeConceptTitle(entry.sectionTitle),
      content: section?.content ?? "",
      bloomLevel: entry.bloomLevel,
      order: entry.learningOrder,
      kind: entry.sectionRole === "support" ? "support" : "concept",
      sourceSections: section ? [section.title] : [entry.sectionTitle],
    });
  }

  return concepts;
}

/** Fallback: group headings into larger study units instead of storing every heading as a concept */
function hierarchicalHeadingFallback(
  chapterTitle: string,
  parsedFiles: ParsedFile[]
): ConceptPlan[] {
  const concepts: ConceptPlan[] = [];
  let globalOrder = 1;

  for (const file of parsedFiles) {
    let pendingIntro = "";
    let current: ConceptPlan | null = null;
    let currentAnchorLevel = 0;
    let previousWasSupport = false;

    for (const section of file.sections) {
      const title = normalizeConceptTitle(section.title);
      const support = isSupportTitle(title);

      if (!current) {
        if (support) {
          pendingIntro = mergeSectionContent(pendingIntro, title, section.content);
          previousWasSupport = true;
          continue;
        }

        current = createFallbackConcept(title, section, globalOrder++);
        current.content = mergeSectionContent(pendingIntro, "", current.content);
        pendingIntro = "";
        currentAnchorLevel = section.level;
        previousWasSupport = false;
        continue;
      }

      const shouldStartNewConcept = !support && (
        section.level <= 2
        || section.level <= currentAnchorLevel
        || previousWasSupport
      );

      if (shouldStartNewConcept) {
        concepts.push(current);
        current = createFallbackConcept(title, section, globalOrder++);
        currentAnchorLevel = section.level;
        previousWasSupport = false;
        continue;
      }

      current.content = mergeSectionContent(
        current.content,
        support ? title : `소주제: ${title}`,
        section.content
      );
      current.bloomLevel = Math.max(current.bloomLevel, inferBloomLevel(title, section.content));
      current.sourceSections = [...(current.sourceSections || []), section.title];
      previousWasSupport = support;
    }

    if (current) {
      concepts.push(current);
    } else if (pendingIntro.trim()) {
      concepts.push({
        title: file.title === chapterTitle ? "핵심 개념" : normalizeConceptTitle(file.title),
        content: pendingIntro.trim(),
        bloomLevel: 2,
        order: globalOrder++,
        sourceSections: [],
      });
    }
  }

  return normalizeConcepts(chapterTitle, concepts);
}

function createFallbackConcept(
  title: string,
  section: ParsedFile["sections"][number],
  order: number
): ConceptPlan {
  return {
    title,
    content: section.content.trim(),
    bloomLevel: inferBloomLevel(title, section.content),
    order,
    sourceSections: [section.title],
  };
}

/** Find a section in parsed files by file index and title */
function findSection(
  parsedFiles: ParsedFile[],
  fileIndex: number,
  sectionTitle: string
): ParsedFile["sections"][number] | undefined {
  const file = parsedFiles[fileIndex];
  if (!file) return undefined;
  return file.sections.find((s) => s.title === sectionTitle)
    ?? file.sections.find((s) => s.title.includes(sectionTitle) || sectionTitle.includes(s.title));
}

function normalizeConcepts(
  chapterTitle: string,
  concepts: ConceptPlan[]
): ConceptPlan[] {
  const sorted = [...concepts]
    .map((concept, index) => normalizeConcept(concept, index))
    .filter((concept) => concept.title || concept.content)
    .sort((a, b) => a.order - b.order);

  const merged = mergeSupportConcepts(chapterTitle, sorted);
  const deduped = mergeDuplicateConcepts(merged);
  const rebalanced = rebalanceBloomLevels(deduped);
  const titleMap = new Map(rebalanced.map((concept) => [titleKey(concept.title), concept.title]));

  return rebalanced.map((concept, index) => ({
    ...concept,
    order: index + 1,
    kind: "concept",
    prerequisites: normalizePrerequisites(concept.prerequisites || [], titleMap, index, rebalanced),
  }));
}

function normalizeConcept(
  concept: ConceptPlan,
  index: number
): ConceptPlan {
  const title = normalizeConceptTitle(concept.title);
  const content = concept.content.trim();

  return {
    title,
    content,
    bloomLevel: Math.min(6, Math.max(1, concept.bloomLevel || inferBloomLevel(title, content))),
    order: Number.isFinite(concept.order) ? concept.order : index + 1,
    kind: concept.kind || "concept",
    prerequisites: [...(concept.prerequisites || [])],
    estimatedMinutes: normalizeEstimatedMinutes(concept.estimatedMinutes),
    assessable: concept.assessable ?? content.length >= 80,
    sourceSections: concept.sourceSections?.filter(Boolean) || [],
  };
}

function mergeSupportConcepts(
  chapterTitle: string,
  concepts: ConceptPlan[]
): ConceptPlan[] {
  const merged: ConceptPlan[] = [];
  let pendingIntro = "";

  for (const concept of concepts) {
    const shouldMerge = concept.kind === "support"
      || isSupportTitle(concept.title)
      || (
        merged.length === 0
        && titleKey(concept.title) === titleKey(chapterTitle)
        && concepts.length > 1
      );

    if (shouldMerge) {
      const supportTitle = titleKey(concept.title) === titleKey(chapterTitle) ? "" : concept.title;
      if (merged.length === 0) {
        pendingIntro = mergeSectionContent(pendingIntro, supportTitle, concept.content);
      } else {
        merged[merged.length - 1] = mergeConceptBlocks(merged[merged.length - 1], concept, supportTitle);
      }
      continue;
    }

    const nextConcept = { ...concept };
    if (pendingIntro.trim()) {
      nextConcept.content = mergeSectionContent(pendingIntro, "", nextConcept.content);
      pendingIntro = "";
    }
    merged.push(nextConcept);
  }

  if (pendingIntro.trim() && merged.length > 0) {
    merged[0] = {
      ...merged[0],
      content: mergeSectionContent(pendingIntro, "", merged[0].content),
    };
  }

  return merged.filter((concept) => concept.title && concept.content.trim());
}

function mergeDuplicateConcepts(concepts: ConceptPlan[]): ConceptPlan[] {
  const merged: ConceptPlan[] = [];

  for (const concept of concepts) {
    const prev = merged[merged.length - 1];
    if (prev && titleKey(prev.title) === titleKey(concept.title)) {
      merged[merged.length - 1] = mergeConceptBlocks(prev, concept, "");
      continue;
    }
    merged.push(concept);
  }

  return merged;
}

function rebalanceBloomLevels(concepts: ConceptPlan[]): ConceptPlan[] {
  const unique = new Set(concepts.map((concept) => concept.bloomLevel));
  if (unique.size > 1) {
    return concepts;
  }

  return concepts.map((concept) => ({
    ...concept,
    bloomLevel: inferBloomLevel(concept.title, concept.content),
  }));
}

function normalizePrerequisites(
  prerequisites: string[],
  titleMap: Map<string, string>,
  index: number,
  concepts: ConceptPlan[]
): string[] {
  const available = new Set(
    concepts.slice(0, index).map((concept) => concept.title)
  );

  const normalized = prerequisites
    .map((item) => titleMap.get(titleKey(item)) || "")
    .filter((item) => item && available.has(item));

  return [...new Set(normalized)];
}

function normalizeEstimatedMinutes(estimatedMinutes?: number): number | undefined {
  if (typeof estimatedMinutes !== "number" || Number.isNaN(estimatedMinutes)) {
    return undefined;
  }

  return Math.min(15, Math.max(1, Math.round(estimatedMinutes)));
}

function normalizeConceptTitle(title: string): string {
  return title
    .replace(/^\d+\s*[\.\)]\s+/, "")
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleKey(title: string): string {
  return normalizeConceptTitle(title).toLowerCase();
}

function isSupportTitle(title: string): boolean {
  const key = titleKey(title);
  if (!key) return true;

  if (SUPPORT_SECTION_TITLES.has(key)) {
    return true;
  }

  return SUPPORT_SECTION_PREFIXES.some((prefix) =>
    key.startsWith(prefix.toLowerCase())
  );
}

function mergeSectionContent(
  baseContent: string,
  sectionTitle: string,
  sectionContent: string
): string {
  const trimmedBase = baseContent.trim();
  const trimmedSection = sectionContent.trim();

  if (!trimmedSection) {
    return trimmedBase;
  }

  const nextBlock = sectionTitle
    ? `### ${sectionTitle}\n${trimmedSection}`
    : trimmedSection;

  return [trimmedBase, nextBlock].filter(Boolean).join("\n\n").trim();
}

function mergeConceptBlocks(
  base: ConceptPlan,
  next: ConceptPlan,
  sectionTitle: string
): ConceptPlan {
  const estimatedMinutes = [base.estimatedMinutes, next.estimatedMinutes]
    .filter((value): value is number => typeof value === "number")
    .reduce((sum, value) => sum + value, 0);

  return {
    ...base,
    content: mergeSectionContent(base.content, sectionTitle, next.content),
    bloomLevel: Math.max(base.bloomLevel, next.bloomLevel),
    prerequisites: [...new Set([...(base.prerequisites || []), ...(next.prerequisites || [])])],
    estimatedMinutes: estimatedMinutes > 0
      ? normalizeEstimatedMinutes(estimatedMinutes)
      : undefined,
    assessable: base.assessable || next.assessable,
    sourceSections: [...new Set([...(base.sourceSections || []), ...(next.sourceSections || [])])],
  };
}

function inferBloomLevel(title: string, content: string): number {
  const text = `${title} ${content}`.toLowerCase();

  if (/(비교|분석|정당성|트레이드오프|선택 기준|관계|vs)/.test(text)) {
    return 4;
  }
  if (/(구현|적용|문제|풀이|알고리즘|패턴|루틴|반례|실수|활용|코드|예제|체크리스트)/.test(text)) {
    return 3;
  }
  if (/(정의|개요|원리|구조|개념|특성|종류|유형)/.test(text)) {
    return 2;
  }
  return 2;
}

function summarizeConceptQuality(concepts: ConceptPlan[]) {
  const total = concepts.length;
  const supportLike = concepts.filter((concept) => isSupportTitle(concept.title)).length;
  const shortContent = concepts.filter((concept) => concept.content.trim().length < 80).length;
  const uniqueBloom = new Set(concepts.map((concept) => concept.bloomLevel)).size;

  return {
    total,
    supportRatio: total > 0 ? supportLike / total : 1,
    shortContentRatio: total > 0 ? shortContent / total : 1,
    uniformBloom: uniqueBloom <= 1,
  };
}

function scoreConceptSet(concepts: ConceptPlan[]): number {
  if (concepts.length === 0) {
    return -1000;
  }

  const summary = summarizeConceptQuality(concepts);
  let score = 100;

  if (summary.total < 3) score -= 10;
  if (summary.total > 12) score -= (summary.total - 12) * 5;
  score -= summary.supportRatio * 40;
  score -= summary.shortContentRatio * 25;
  if (summary.uniformBloom && summary.total > 4) score -= 15;

  return score;
}

function needsConceptRepair(concepts: ConceptPlan[]): boolean {
  const summary = summarizeConceptQuality(concepts);

  return (
    summary.total === 0
    || summary.total > 18
    || summary.supportRatio > 0.2
    || summary.shortContentRatio > 0.45
    || (summary.uniformBloom && summary.total > 4)
  );
}

function pickBetterConceptSet(...candidates: ConceptPlan[][]): ConceptPlan[] {
  return candidates
    .filter((candidate) => candidate.length > 0)
    .sort((left, right) => scoreConceptSet(right) - scoreConceptSet(left))[0] || [];
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
