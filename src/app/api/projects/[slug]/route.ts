import { NextResponse } from "next/server";
import { updateProjectSchema } from "@/infrastructure/llm/schemas";
import { projectService } from "@/application/project/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const detail = await projectService.getDetail(slug);

  if (!detail) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const body = await request.json();
  const parsed = updateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "유효하지 않은 입력", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { slug } = await params;
  const result = await projectService.update(slug, parsed.data);

  if ("error" in result) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const result = await projectService.delete(slug);

  if (result.error === "not_found") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (result.error === "busy") {
    return NextResponse.json(
      { error: "임포트 진행 중인 프로젝트는 삭제할 수 없습니다" },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
