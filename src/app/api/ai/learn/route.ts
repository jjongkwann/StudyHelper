import { NextResponse } from "next/server";
import { studyService } from "@/application/study/service";

export async function POST(request: Request) {
  const { conceptId } = await request.json();

  if (!conceptId) {
    return NextResponse.json({ error: "conceptId is required" }, { status: 400 });
  }

  try {
    const result = await studyService.learn(conceptId);
    if (!result) {
      return NextResponse.json({ error: "Concept not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "학습 콘텐츠 생성 중 AI 응답을 검증하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
