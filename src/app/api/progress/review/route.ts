import { NextResponse } from "next/server";
import { studyService } from "@/application/study/service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const result = await studyService.getReviewItems(projectId);
  return NextResponse.json(result);
}
