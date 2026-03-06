import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { scanMarkdownFiles, parseMarkdownFile } from "@/lib/parser/markdown";
import { join } from "path";

// GET /api/projects - 프로젝트 목록 조회
export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      chapters: {
        include: {
          concepts: {
            include: {
              studyProgress: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 진도율 계산
  const projectsWithProgress = projects.map((project) => {
    const totalConcepts = project.chapters.reduce(
      (sum, ch) => sum + ch.concepts.length,
      0
    );
    const learnedConcepts = project.chapters.reduce(
      (sum, ch) =>
        sum +
        ch.concepts.filter((c) => c.studyProgress.some((p) => p.mastery >= 3))
          .length,
      0
    );
    const reviewDue = project.chapters.reduce(
      (sum, ch) =>
        sum +
        ch.concepts.filter((c) =>
          c.studyProgress.some(
            (p) => p.nextReviewAt && p.nextReviewAt <= new Date()
          )
        ).length,
      0
    );

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      contentPath: project.contentPath,
      chapterCount: project.chapters.length,
      totalConcepts,
      learnedConcepts,
      reviewDue,
      progress: totalConcepts > 0 ? Math.round((learnedConcepts / totalConcepts) * 100) : 0,
      createdAt: project.createdAt,
    };
  });

  return NextResponse.json(projectsWithProgress);
}

// POST /api/projects - 프로젝트 생성 + MD 임포트
export async function POST(request: Request) {
  const body = await request.json();
  const { name, slug, description, contentPath } = body;

  if (!name || !slug || !contentPath) {
    return NextResponse.json(
      { error: "name, slug, contentPath are required" },
      { status: 400 }
    );
  }

  // 프로젝트 생성
  const project = await prisma.project.create({
    data: { name, slug, description, contentPath },
  });

  // MD 파일 스캔 및 임포트
  const basePath = join(process.cwd(), "content", contentPath);
  const mdFiles = await scanMarkdownFiles(basePath);

  for (let i = 0; i < mdFiles.length; i++) {
    const parsed = await parseMarkdownFile(mdFiles[i], basePath);

    await prisma.chapter.create({
      data: {
        projectId: project.id,
        title: parsed.title,
        order: i + 1,
        sourceFile: parsed.sourceFile,
        contentHash: parsed.contentHash,
        rawContent: parsed.rawContent,
        concepts: {
          create: parsed.sections.map((section) => ({
            title: section.title,
            content: section.content,
            bloomLevel: 1,
            order: section.order,
          })),
        },
      },
    });
  }

  return NextResponse.json(project, { status: 201 });
}
