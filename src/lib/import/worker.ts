import { prisma } from "@/lib/db/prisma";
import { getAIProvider } from "@/lib/ai/provider";
import {
  organizeChaptersPrompt,
  analyzeConceptsPrompt,
  SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import { scanMarkdownFiles, parseMarkdownFile } from "@/lib/parser/markdown";
import { chapterOrganizationSchema, conceptAnalysisSchema } from "./schemas";
import { basename, join, isAbsolute } from "path";
import { readFile } from "fs/promises";

/** 안전한 JSON 파싱: 코드블록 제거 후 파싱 */
function safeParseJSON(text: string): unknown {
  const cleaned = text
    .replace(/```json\s*\n?/g, "")
    .replace(/```\s*$/g, "")
    .trim();
  return JSON.parse(cleaned);
}

/** 프로젝트 상태 업데이트 헬퍼 */
async function updateStatus(
  projectId: string,
  status: string,
  step?: string,
  progress?: number,
  errorMessage?: string
) {
  await prisma.project.update({
    where: { id: projectId },
    data: {
      status,
      importStep: step ?? null,
      importProgress: progress ?? null,
      errorMessage: errorMessage ?? null,
    },
  });
}

/** 백그라운드 임포트 실행 */
export async function runImport(projectId: string) {
  try {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    await updateStatus(projectId, "processing", "파일 스캔 중...", 0);

    // 1. 경로 확인 및 MD 파일 스캔
    const basePath = isAbsolute(project.contentPath)
      ? project.contentPath
      : join(process.cwd(), "content", project.contentPath);

    const mdFiles = await scanMarkdownFiles(basePath);
    if (mdFiles.length === 0) {
      await updateStatus(projectId, "failed", undefined, undefined, "콘텐츠 경로에 마크다운 파일이 없습니다");
      return;
    }

    // 목차 파일 찾기
    const syllabusFile = mdFiles.find(
      (f) => basename(f).startsWith("_목차") || basename(f).startsWith("_index")
    );
    const contentFiles = mdFiles.filter((f) => !basename(f).startsWith("_"));
    const fileNames = contentFiles.map((f) => basename(f));

    await updateStatus(projectId, "processing", `${fileNames.length}개 파일 발견. 챕터 구성 중...`, 0.1);

    // 2. AI 챕터 구성
    const ai = getAIProvider();
    let chapters: { title: string; description: string; order: number; files: string[] }[];

    try {
      const syllabusContent = syllabusFile
        ? await readFile(syllabusFile, "utf-8")
        : `사용 가능한 학습 파일: ${fileNames.map((f) => f.replace(/\.md$/, "")).join(", ")}`;

      const response = await ai.generate(
        organizeChaptersPrompt(syllabusContent, fileNames),
        { system: SYSTEM_PROMPT }
      );

      const parsed = safeParseJSON(response);
      const validated = chapterOrganizationSchema.parse(parsed);
      chapters = validated.chapters;

      // 빈 files 배열 체크
      const emptyChapters = chapters.filter((c) => c.files.length === 0);
      if (emptyChapters.length > 0) {
        console.warn(`빈 챕터 발견: ${emptyChapters.map((c) => c.title).join(", ")}`);
      }
      chapters = chapters.filter((c) => c.files.length > 0);
    } catch (e) {
      // 폴백: 파일별 1챕터
      console.error("AI 챕터 구성 실패, 파일 기반 폴백:", e);
      chapters = fileNames.map((f, i) => ({
        title: f.replace(/\.md$/, ""),
        description: "",
        order: i + 1,
        files: [f],
      }));
    }

    if (chapters.length === 0) {
      await updateStatus(projectId, "failed", undefined, undefined, "챕터를 구성할 수 없습니다");
      return;
    }

    await updateStatus(
      projectId,
      "processing",
      `${chapters.length}개 챕터 구성 완료. 개념 분석 중...`,
      0.3
    );

    // 3. 챕터별 개념 분석 + DB 저장 (트랜잭션)
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const progress = 0.3 + (0.65 * (i / chapters.length));
      await updateStatus(
        projectId,
        "processing",
        `개념 분석 중... (${i + 1}/${chapters.length}) ${chapter.title}`,
        progress
      );

      const chapterFiles = chapter.files
        .map((fileName) => contentFiles.find((f) => basename(f) === fileName))
        .filter((f): f is string => !!f);

      if (chapterFiles.length === 0) continue;

      const parsedFiles = await Promise.all(
        chapterFiles.map((f) => parseMarkdownFile(f, basePath))
      );

      const combinedContent = parsedFiles.map((p) => p.rawContent).join("\n\n---\n\n");

      // AI 개념 분석
      let concepts: { title: string; content: string; bloomLevel: number; order: number }[];
      try {
        const response = await ai.generate(
          analyzeConceptsPrompt(chapter.title, combinedContent),
          { system: SYSTEM_PROMPT }
        );
        const parsed = safeParseJSON(response);
        const validated = conceptAnalysisSchema.parse(parsed);
        concepts = validated.concepts;
      } catch (e) {
        // 폴백: MD 헤딩 기반
        console.error(`AI 개념 분석 실패 (${chapter.title}), 헤딩 기반 폴백:`, e);
        concepts = parsedFiles.flatMap((p, fi) =>
          p.sections.map((s, si) => ({
            title: s.title,
            content: s.content,
            bloomLevel: 1,
            order: fi * 100 + si + 1,
          }))
        );
      }

      // 트랜잭션으로 챕터 + 개념 원자적 저장
      await prisma.$transaction(async (tx) => {
        await tx.chapter.create({
          data: {
            projectId,
            title: chapter.title,
            order: chapter.order,
            sourceFile: chapter.files.join(", "),
            contentHash: parsedFiles.map((p) => p.contentHash).join(","),
            rawContent: combinedContent,
            concepts: {
              create: concepts.map((c, idx) => ({
                title: c.title,
                content: c.content,
                bloomLevel: Math.min(6, Math.max(1, c.bloomLevel || 1)),
                order: c.order || idx + 1,
              })),
            },
          },
        });
      });
    }

    // 4. 완료
    await updateStatus(projectId, "ready", "임포트 완료", 1.0);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Import failed for project ${projectId}:`, message);
    await updateStatus(projectId, "failed", undefined, undefined, message);
  }
}
