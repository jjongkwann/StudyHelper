import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";
import { evaluateAnswerPrompt, SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db/prisma";
import { calculateSM2, scoreToQuality } from "@/lib/spaced-repetition/sm2";

// POST /api/ai/evaluate - 답변 평가 + 진도 업데이트
export async function POST(request: Request) {
  const { sessionId, conceptId, question, userAnswer, bloomLevel } =
    await request.json();

  if (!conceptId || !question || !userAnswer) {
    return NextResponse.json(
      { error: "conceptId, question, userAnswer are required" },
      { status: 400 }
    );
  }

  const concept = await prisma.concept.findUnique({
    where: { id: conceptId },
    include: { studyProgress: true },
  });

  if (!concept) {
    return NextResponse.json({ error: "Concept not found" }, { status: 404 });
  }

  // AI 채점
  const ai = getAIProvider();
  const response = await ai.generate(
    evaluateAnswerPrompt(question, concept.content, userAnswer),
    { system: SYSTEM_PROMPT }
  );

  let evaluation;
  try {
    evaluation = JSON.parse(response);
  } catch {
    evaluation = {
      score: 0,
      feedback: response,
      correctAnswer: "",
      weakPoints: [],
    };
  }

  const score = Math.max(0, Math.min(5, evaluation.score));

  // QuizAttempt 저장
  if (sessionId) {
    await prisma.quizAttempt.create({
      data: {
        sessionId,
        conceptId,
        question,
        userAnswer,
        aiFeedback: evaluation.feedback,
        score,
        bloomLevel: bloomLevel || 1,
      },
    });
  }

  // StudyProgress 업데이트 (SM-2)
  const existing = concept.studyProgress[0];
  const sm2Input = {
    quality: scoreToQuality(score),
    repetitions: existing?.repetitions || 0,
    easeFactor: existing?.easeFactor || 2.5,
    intervalDays: existing?.intervalDays || 0,
  };
  const sm2Result = calculateSM2(sm2Input);

  const consecutiveFails =
    score < 3 ? (existing?.consecutiveFails || 0) + 1 : 0;

  await prisma.studyProgress.upsert({
    where: { conceptId },
    create: {
      conceptId,
      mastery: score,
      bloomLevelReached: bloomLevel || 1,
      easeFactor: sm2Result.easeFactor,
      intervalDays: sm2Result.intervalDays,
      repetitions: sm2Result.repetitions,
      nextReviewAt: sm2Result.nextReviewAt,
      totalAttempts: 1,
      correctAttempts: score >= 3 ? 1 : 0,
      consecutiveFails,
    },
    update: {
      mastery: score,
      bloomLevelReached: Math.max(existing?.bloomLevelReached || 0, bloomLevel || 1),
      easeFactor: sm2Result.easeFactor,
      intervalDays: sm2Result.intervalDays,
      repetitions: sm2Result.repetitions,
      nextReviewAt: sm2Result.nextReviewAt,
      totalAttempts: { increment: 1 },
      correctAttempts: score >= 3 ? { increment: 1 } : undefined,
      consecutiveFails,
    },
  });

  return NextResponse.json({
    ...evaluation,
    score,
    sm2: sm2Result,
    needsRelearning: sm2Result.easeFactor < 1.5 || consecutiveFails >= 2,
  });
}
