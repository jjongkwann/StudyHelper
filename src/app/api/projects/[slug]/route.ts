import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET /api/projects/:slug - 프로젝트 상세 조회
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      chapters: {
        orderBy: { order: "asc" },
        include: {
          concepts: {
            orderBy: { order: "asc" },
            include: {
              studyProgress: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // 챕터별 통계 계산
  const chaptersWithStats = project.chapters.map((chapter) => {
    const totalConcepts = chapter.concepts.length;
    const learnedConcepts = chapter.concepts.filter((c) =>
      c.studyProgress.some((p) => p.mastery >= 3)
    ).length;
    const reviewDue = chapter.concepts.filter((c) =>
      c.studyProgress.some(
        (p) => p.nextReviewAt && p.nextReviewAt <= new Date()
      )
    ).length;
    const needsRelearning = chapter.concepts.filter((c) =>
      c.studyProgress.some((p) => p.easeFactor < 1.5 || p.consecutiveFails >= 2)
    ).length;

    return {
      id: chapter.id,
      title: chapter.title,
      order: chapter.order,
      sourceFile: chapter.sourceFile,
      conceptCount: totalConcepts,
      learnedConcepts,
      reviewDue,
      needsRelearning,
      progress: totalConcepts > 0 ? Math.round((learnedConcepts / totalConcepts) * 100) : 0,
      concepts: chapter.concepts.map((c) => ({
        id: c.id,
        title: c.title,
        bloomLevel: c.bloomLevel,
        order: c.order,
        progress: c.studyProgress[0] || null,
      })),
    };
  });

  return NextResponse.json({
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    chapters: chaptersWithStats,
  });
}
