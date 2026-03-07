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

async function generateLearnContent(conceptId: string) {
  const concept = await studyRepo.getConceptWithChapter(conceptId);
  if (!concept) return null;

  const cached = parseCachedLearnContent(concept.learnCache);
  if (cached) return cached;

  const result = await llmGateway.generateAndValidate(
    learnConceptPrompt(
      `${concept.title}\n${concept.content}`,
      concept.chapter.rawContent
    ),
    { system: SYSTEM_PROMPT, schema: learnContentSchema, retries: 2 }
  );

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
