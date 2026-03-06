import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";
import { learnConceptPrompt, SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db/prisma";

// POST /api/ai/learn - AI 학습 콘텐츠 생성
export async function POST(request: Request) {
  const { conceptId } = await request.json();

  if (!conceptId) {
    return NextResponse.json({ error: "conceptId is required" }, { status: 400 });
  }

  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    include: {
      chapter: true,
    },
  });

  if (!concept) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }

  const ai = getAIProvider();
  const response = await ai.generate(
    learnConceptPrompt(
      `${concept.title}\n${concept.content}`,
      concept.chapter.rawContent
    ),
    { system: SYSTEM_PROMPT }
  );

  try {
    const parsed = JSON.parse(response);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({
      explanation: response,
      keyPoints: [],
      checkQuestion: null,
    });
  }
}
