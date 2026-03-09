import { llmGateway } from "@/infrastructure/llm/gateway";
import { learnConceptPrompt, SYSTEM_PROMPT } from "@/infrastructure/llm/prompts";
import { learnContentSchema } from "@/infrastructure/llm/schemas";
import { studyRepo } from "@/infrastructure/db/repositories/study";
import { learnJobRepo } from "@/infrastructure/db/repositories/learn-job";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCachedLearnContent(cache: string | null | undefined) {
  if (!cache) return null;

  try {
    return learnContentSchema.parse(JSON.parse(cache));
  } catch {
    return null;
  }
}

function stripMarkdown(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeyPoints(content: string) {
  const bulletLines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*+]\s+/.test(line))
    .map((line) => stripMarkdown(line.replace(/^[-*+]\s+/, "")))
    .filter(Boolean);

  if (bulletLines.length > 0) {
    return bulletLines.slice(0, 5);
  }

  const headingLines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^#{1,6}\s+/.test(line))
    .map((line) => stripMarkdown(line))
    .filter(Boolean);

  if (headingLines.length > 0) {
    return [...new Set(headingLines)].slice(0, 5);
  }

  const plain = stripMarkdown(content);
  return plain
    .split(/(?<=[.!?]|다\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20)
    .slice(0, 4);
}

function buildFallbackLearnContent(concept: NonNullable<Awaited<ReturnType<typeof studyRepo.getConceptWithChapter>>>) {
  const keyPoints = extractKeyPoints(concept.content);
  const explanationSections = [
    `## ${concept.title}`,
    concept.content.trim(),
  ];

  if (keyPoints.length > 0) {
    explanationSections.push(
      "## 핵심 포인트",
      keyPoints.map((point) => `- ${point}`).join("\n")
    );
  }

  return {
    explanation: explanationSections.filter(Boolean).join("\n\n").trim(),
    keyPoints,
    checkQuestion: keyPoints.length > 0
      ? {
          question: `${concept.title}의 핵심 원리나 사용 상황을 설명해보세요.`,
          expectedAnswer: keyPoints.slice(0, 3).join(" / "),
        }
      : null,
  };
}

function buildFocusedChapterContext(
  chapterTitle: string,
  rawContent: string,
  conceptTitle: string,
  maxChars = 5000
) {
  const trimmed = rawContent.trim();
  if (trimmed.length <= maxChars) {
    return `챕터: ${chapterTitle}\n\n${trimmed}`;
  }

  const normalizedTitle = conceptTitle.trim().toLowerCase();
  const lowerContent = trimmed.toLowerCase();
  const hitIndex = normalizedTitle
    ? lowerContent.indexOf(normalizedTitle)
    : -1;

  if (hitIndex < 0) {
    return `챕터: ${chapterTitle}\n\n${trimmed.slice(0, maxChars)}\n\n[중략]`;
  }

  const windowSize = Math.max(1200, Math.floor((maxChars - chapterTitle.length) / 2));
  const start = Math.max(0, hitIndex - windowSize);
  const end = Math.min(trimmed.length, hitIndex + windowSize);
  const prefix = start > 0 ? "[앞부분 생략]\n\n" : "";
  const suffix = end < trimmed.length ? "\n\n[뒷부분 생략]" : "";
  const snippet = trimmed.slice(start, end).trim();

  return `챕터: ${chapterTitle}\n\n${prefix}${snippet}${suffix}`;
}

async function generateLearnContent(conceptId: string) {
  const concept = await studyRepo.getConceptWithChapter(conceptId);
  if (!concept) return null;

  const cached = parseCachedLearnContent(concept.learnCache);
  if (cached) return cached;

  let result;
  try {
    result = await llmGateway.generateAndValidate(
      learnConceptPrompt(
        `${concept.title}\n${concept.content}`,
        buildFocusedChapterContext(
          concept.chapter.title,
          concept.chapter.rawContent,
          concept.title
        )
      ),
      { system: SYSTEM_PROMPT, schema: learnContentSchema, retries: 2 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`learn content fallback 사용 (${concept.title}):`, message);
    result = buildFallbackLearnContent(concept);
  }

  await studyRepo.cacheLearnContent(conceptId, JSON.stringify(result));
  return result;
}

async function waitForWorkerCache(conceptId: string, timeoutMs = 2500) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const cache = await studyRepo.getConceptCache(conceptId);
    const parsed = parseCachedLearnContent(cache?.learnCache);
    if (parsed) return parsed;

    const activeJob = await learnJobRepo.findActiveByConceptId(conceptId);
    if (!activeJob) break;

    await sleep(250);
  }

  return null;
}

export async function getOrCreateLearnContent(conceptId: string) {
  const concept = await studyRepo.getConceptWithChapter(conceptId);
  if (!concept) return null;

  const cached = parseCachedLearnContent(concept.learnCache);
  if (cached) return cached;

  const activeJob = await learnJobRepo.findActiveByConceptId(conceptId);
  if (activeJob) {
    const waited = await waitForWorkerCache(conceptId);
    if (waited) return waited;
  }

  return generateLearnContent(conceptId);
}

declare global {
  var __studyhelperLearnWorkerRunning: boolean | undefined;
}

async function processLearnQueue() {
  while (true) {
    const job = await learnJobRepo.claimNextPending();
    if (!job) return;

    try {
      await generateLearnContent(job.conceptId);
      await learnJobRepo.complete(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await learnJobRepo.fail(job.id, message);
    }
  }
}

export function startLearnCacheWorker() {
  if (globalThis.__studyhelperLearnWorkerRunning) return;

  globalThis.__studyhelperLearnWorkerRunning = true;
  void processLearnQueue().finally(() => {
    globalThis.__studyhelperLearnWorkerRunning = false;
  });
}

export async function enqueueChapterLearnCache(
  chapterId: string,
  excludeConceptId?: string
) {
  const concepts = await studyRepo.getConceptsByChapter(chapterId);
  const queueItems = concepts
    .filter((concept) => !concept.learnCache && concept.id !== excludeConceptId)
    .map((concept) => ({
      conceptId: concept.id,
      priority: concept.order,
    }));

  const result = await learnJobRepo.enqueueMany(queueItems);
  startLearnCacheWorker();
  return {
    queued: result.created + result.reset,
    totalMissing: queueItems.length,
  };
}
