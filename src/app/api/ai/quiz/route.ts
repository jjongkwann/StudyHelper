import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";
import { generateQuizPrompt, SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db/prisma";

// POST /api/ai/quiz - AI 퀴즈 생성
export async function POST(request: Request) {
  const { chapterIds, bloomLevel, count } = await request.json();

  if (!chapterIds?.length || !bloomLevel || !count) {
    return NextResponse.json(
      { error: "chapterIds, bloomLevel, count are required" },
      { status: 400 }
    );
  }

  const concepts = await prisma.concept.findMany({
    where: {
      chapterId: { in: chapterIds },
    },
    orderBy: { order: "asc" },
  });

  if (concepts.length === 0) {
    return NextResponse.json({ error: "No concepts found" }, { status: 404 });
  }

  const ai = getAIProvider();
  const response = await ai.generate(
    generateQuizPrompt(
      concepts.map((c) => ({ title: c.title, content: c.content })),
      bloomLevel,
      count
    ),
    { system: SYSTEM_PROMPT }
  );

  try {
    const parsed = JSON.parse(response);
    // conceptId 매핑
    const questions = parsed.questions.map(
      (q: { conceptTitle: string; question: string; bloomLevel: number; hints?: string[] }) => {
        const matchedConcept = concepts.find(
          (c) => c.title === q.conceptTitle
        );
        return {
          ...q,
          conceptId: matchedConcept?.id || concepts[0].id,
        };
      }
    );
    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }
}
