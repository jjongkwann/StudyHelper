import { NextResponse } from "next/server";
import { projectService } from "@/application/project/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const status = await projectService.getStatus(slug);

  if (!status) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(status);
}
