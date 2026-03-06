import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET /api/projects/:slug/status — 임포트 진행 상태 조회
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const project = await prisma.project.findUnique({
    where: { slug },
    select: {
      id: true,
      status: true,
      importStep: true,
      importProgress: true,
      errorMessage: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}
