import { NextResponse } from "next/server";
import { studyService } from "@/application/study/service";

export async function POST(request: Request) {
  const { sessionId, conceptId, question, userAnswer, bloomLevel } =
    await request.json();

  if (!conceptId || !question || !userAnswer) {
    return NextResponse.json(
      { error: "conceptId, question, userAnswer are required" },
      { status: 400 }
    );
  }

  try {
    const result = await studyService.evaluate({
      sessionId,
      conceptId,
      question,
      userAnswer,
      bloomLevel,
    });

    if (!result) {
      return NextResponse.json({ error: "Concept not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "답변 평가 중 AI 응답을 검증하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
