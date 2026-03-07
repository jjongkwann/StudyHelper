import { NextResponse } from "next/server";
import { studyService } from "@/application/study/service";

export async function POST(request: Request) {
  const { chapterIds, bloomLevel, count } = await request.json();

  if (!chapterIds?.length || !bloomLevel || !count) {
    return NextResponse.json(
      { error: "chapterIds, bloomLevel, count are required" },
      { status: 400 }
    );
  }

  try {
    const result = await studyService.generateQuiz(chapterIds, bloomLevel, count);
    if (!result) {
      return NextResponse.json({ error: "No concepts found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "퀴즈 생성 중 AI 응답을 검증하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
