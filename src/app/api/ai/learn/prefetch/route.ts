import { NextResponse } from "next/server";
import { studyService } from "@/application/study/service";

export async function POST(request: Request) {
  const { chapterId, excludeConceptId } = await request.json();

  if (!chapterId) {
    return NextResponse.json({ error: "chapterId is required" }, { status: 400 });
  }

  try {
    const result = await studyService.prefetchLearnContent(
      chapterId,
      excludeConceptId
    );
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "학습 콘텐츠 백그라운드 생성을 시작하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
