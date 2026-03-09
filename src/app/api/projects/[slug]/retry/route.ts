import { NextResponse } from "next/server";
import { projectService } from "@/application/project/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const result = await projectService.retry(slug);

  if ("error" in result) {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (result.error === "busy") {
      return NextResponse.json(
        { error: "프로젝트 임포트가 이미 진행 중입니다" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "프로젝트를 다시 생성할 수 없습니다" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      ...result,
      message: result.mode === "retry"
        ? "임포트를 재시도합니다."
        : "기존 프로젝트 내용을 재정리하여 교체합니다.",
    },
    { status: 202 }
  );
}
