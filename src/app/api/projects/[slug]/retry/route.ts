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
    return NextResponse.json(
      { error: "프로젝트가 실패 상태가 아닙니다" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { ...result, message: "임포트를 재시도합니다." },
    { status: 202 }
  );
}
