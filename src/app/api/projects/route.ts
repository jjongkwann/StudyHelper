import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createProjectSchema } from "@/lib/import/schemas";
import { runImport } from "@/lib/import/worker";
import { Prisma } from "@prisma/client";

// GET /api/projects
export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      chapters: {
        include: {
          concepts: {
            include: { studyProgress: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = projects.map((project) => {
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
      status: project.status,
      importStep: project.importStep,
      importProgress: project.importProgress,
      errorMessage: project.errorMessage,
      chapterCount: project.chapters.length,
      totalConcepts,
      learnedConcepts,
      reviewDue,
      progress:
        totalConcepts > 0
          ? Math.round((learnedConcepts / totalConcepts) * 100)
          : 0,
      createdAt: project.createdAt,
    };
  });

  return NextResponse.json(result);
}

// POST /api/projects — 프로젝트 생성 + 비동기 임포트 시작
export async function POST(request: Request) {
  // 1. 요청 검증
  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "유효하지 않은 입력", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, slug, description, contentPath } = parsed.data;

  // 2. 프로젝트 생성 (status=pending)
  let project;
  try {
    project = await prisma.project.create({
      data: { name, slug, description, contentPath, status: "pending" },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: `slug "${slug}"가 이미 존재합니다` },
        { status: 409 }
      );
    }
    throw e;
  }

  // 3. 백그라운드 임포트 시작 (await 하지 않음)
  runImport(project.id).catch((err) => {
    console.error("Background import error:", err);
  });

  // 4. 즉시 202 반환
  return NextResponse.json(
    {
      id: project.id,
      slug: project.slug,
      status: "pending",
      message: "프로젝트가 생성되었습니다. 임포트가 진행 중입니다.",
    },
    { status: 202 }
  );
}
