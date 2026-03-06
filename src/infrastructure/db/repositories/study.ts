import { prisma } from "../prisma";
import { calculateSM2, scoreToQuality } from "@/lib/spaced-repetition/sm2";

export const studyRepo = {
  async getConceptWithChapter(conceptId: string) {
    return prisma.concept.findUnique({
      where: { id: conceptId },
      include: { chapter: true, studyProgress: true },
    });
  },

  async getConceptsByChapters(chapterIds: string[]) {
    return prisma.concept.findMany({
      where: { chapterId: { in: chapterIds } },
      orderBy: { order: "asc" },
    });
  },

  async saveQuizAttempt(data: {
    sessionId: string;
    conceptId: string;
    question: string;
    userAnswer: string;
    aiFeedback: string;
    score: number;
    bloomLevel: number;
  }) {
    return prisma.quizAttempt.create({ data });
  },

  async updateProgress(conceptId: string, score: number, bloomLevel: number) {
    const concept = await prisma.concept.findUnique({
      where: { id: conceptId },
      include: { studyProgress: true },
    });
    if (!concept) throw new Error("Concept not found");

    const existing = concept.studyProgress[0];
    const sm2Input = {
      quality: scoreToQuality(score),
      repetitions: existing?.repetitions || 0,
      easeFactor: existing?.easeFactor || 2.5,
      intervalDays: existing?.intervalDays || 0,
    };
    const sm2Result = calculateSM2(sm2Input);
    const consecutiveFails = score < 3 ? (existing?.consecutiveFails || 0) + 1 : 0;

    await prisma.studyProgress.upsert({
      where: { conceptId },
      create: {
        conceptId,
        mastery: score,
        bloomLevelReached: bloomLevel,
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
        bloomLevelReached: Math.max(existing?.bloomLevelReached || 0, bloomLevel),
        easeFactor: sm2Result.easeFactor,
        intervalDays: sm2Result.intervalDays,
        repetitions: sm2Result.repetitions,
        nextReviewAt: sm2Result.nextReviewAt,
        totalAttempts: { increment: 1 },
        correctAttempts: score >= 3 ? { increment: 1 } : undefined,
        consecutiveFails,
      },
    });

    return { sm2: sm2Result, consecutiveFails };
  },

  async getReviewItems(projectId: string) {
    const now = new Date();

    const [dueItems, relearningItems] = await Promise.all([
      prisma.studyProgress.findMany({
        where: {
          nextReviewAt: { lte: now },
          concept: { chapter: { projectId } },
        },
        include: {
          concept: { include: { chapter: { select: { title: true } } } },
        },
        orderBy: { nextReviewAt: "asc" },
      }),
      prisma.studyProgress.findMany({
        where: {
          OR: [{ easeFactor: { lt: 1.5 } }, { consecutiveFails: { gte: 2 } }],
          concept: { chapter: { projectId } },
        },
        include: {
          concept: { include: { chapter: { select: { title: true } } } },
        },
      }),
    ]);

    return {
      dueCount: dueItems.length,
      relearningCount: relearningItems.length,
      dueItems: dueItems.map((item) => ({
        conceptId: item.conceptId,
        conceptTitle: item.concept.title,
        chapterTitle: item.concept.chapter.title,
        mastery: item.mastery,
        easeFactor: item.easeFactor,
        intervalDays: item.intervalDays,
        lastReviewed: item.updatedAt,
        needsRelearning: item.easeFactor < 1.5 || item.consecutiveFails >= 2,
      })),
      relearningItems: relearningItems.map((item) => ({
        conceptId: item.conceptId,
        conceptTitle: item.concept.title,
        chapterTitle: item.concept.chapter.title,
        easeFactor: item.easeFactor,
        consecutiveFails: item.consecutiveFails,
      })),
    };
  },
};
