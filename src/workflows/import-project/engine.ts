import type { ImportState, ImportStepName } from "@/core/types";
import { emptyImportState } from "@/core/types";
import { projectRepo } from "@/infrastructure/db/repositories/project";
import { importJobRepo } from "@/infrastructure/db/repositories/import-job";
import { chapterRepo } from "@/infrastructure/db/repositories/chapter";
import {
  validateInput,
  scanFiles,
  extractTopics,
  classifyFiles,
  buildChapters,
  validatePlan,
  analyzeChapter,
  persistChapter,
} from "./steps";

async function runStep(
  step: ImportStepName,
  state: ImportState
): Promise<ImportState> {
  switch (step) {
    case "validateInput":
      return validateInput(state);
    case "scanFiles":
      return scanFiles(state);
    case "extractTopics":
      return extractTopics(state);
    case "classifyFiles":
      return classifyFiles(state);
    case "buildChapters":
      return buildChapters(state);
    case "validatePlan":
      return validatePlan(state);
    case "analyzeChapter":
      return analyzeChapter(state);
    case "persistChapter":
      return persistChapter(state);
    case "finalize":
      return state;
  }
}

/** Run the full import workflow for a project */
export async function runImportWorkflow(
  projectId: string,
  resumeState?: ImportState
) {
  const project = await projectRepo.findById(projectId);
  if (!project) throw new Error("Project not found");

  let state: ImportState;
  if (resumeState) {
    state = resumeState;
  } else {
    state = emptyImportState(projectId, project.contentPath, "");
  }

  try {
    await projectRepo.updateStatus(projectId, "processing", {
      importStep: "시작 중...",
      importProgress: 0,
    });

    // -- validateInput --
    state = await executeStep("validateInput", state, projectId, "파일 경로 확인 중...", 0.03);

    // -- scanFiles --
    state = await executeStep("scanFiles", state, projectId, "파일 스캔 중...", 0.06);

    // -- planChapters chain (4 steps) --
    const fileCount = state.contentFiles.length;

    state = await executeStep(
      "extractTopics", state, projectId,
      `${fileCount}개 파일 발견. 주제 추출 중...`, 0.10
    );

    state = await executeStep(
      "classifyFiles", state, projectId,
      `${state.topics.length}개 주제에 파일 분류 중...`, 0.15
    );

    state = await executeStep(
      "buildChapters", state, projectId,
      "챕터 구성 중...", 0.20
    );

    state = await executeStep(
      "validatePlan", state, projectId,
      "챕터 계획 검증 중...", 0.25
    );

    // -- Per-chapter: analyze + persist --
    for (let i = 0; i < state.chapters.length; i++) {
      state = { ...state, currentChapterIndex: i };
      const chapter = state.chapters[i];
      const progress = 0.28 + 0.67 * (i / state.chapters.length);

      state = await executeStep(
        "analyzeChapter", state, projectId,
        `개념 분석 중... (${i + 1}/${state.chapters.length}) ${chapter.title}`,
        progress
      );

      state = await executeStep(
        "persistChapter", state, projectId,
        `저장 중... (${i + 1}/${state.chapters.length}) ${chapter.title}`,
        progress + 0.335 / state.chapters.length
      );
    }

    // -- finalize --
    const finalJob = await importJobRepo.create(projectId, "finalize");
    await importJobRepo.start(finalJob.id);
    await projectRepo.updateStatus(projectId, "ready", {
      importStep: "임포트 완료",
      importProgress: 1.0,
    });
    await importJobRepo.complete(finalJob.id, { chaptersImported: state.chapters.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Import failed for project ${projectId}:`, message);
    await projectRepo.updateStatus(projectId, "failed", {
      errorMessage: message,
    });
  }
}

async function executeStep(
  step: ImportStepName,
  state: ImportState,
  projectId: string,
  stepLabel: string,
  progress: number
): Promise<ImportState> {
  const job = await importJobRepo.create(projectId, step);
  await importJobRepo.start(job.id, { currentChapterIndex: state.currentChapterIndex });
  await projectRepo.updateStatus(projectId, "processing", {
    importStep: stepLabel,
    importProgress: progress,
  });

  try {
    const newState = await runStep(step, state);
    await importJobRepo.complete(job.id, { ok: true });
    return newState;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await importJobRepo.fail(job.id, message);
    throw e; // propagate to the main catch
  }
}

/** Retry a failed import: cleans up partial data and re-runs from scratch */
export async function retryImportWorkflow(projectId: string) {
  // Clean up previous import data
  await chapterRepo.deleteByProjectId(projectId);
  await importJobRepo.deleteByProject(projectId);

  // Re-run from scratch
  await runImportWorkflow(projectId);
}
