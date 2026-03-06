import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createProjectSchema } from "@/infrastructure/llm/schemas";
import { projectService } from "@/application/project/service";

export async function GET() {
  const projects = await projectService.list();
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "유효하지 않은 입력", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await projectService.create(parsed.data);
    return NextResponse.json(
      { ...result, message: "프로젝트가 생성되었습니다. 임포트가 진행 중입니다." },
      { status: 202 }
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: `slug "${parsed.data.slug}"가 이미 존재합니다` },
        { status: 409 }
      );
    }
    throw e;
  }
}
