import { llmGateway } from "@/infrastructure/llm/gateway";
import {
  generateQuizPrompt,
  evaluateAnswerPrompt,
  SYSTEM_PROMPT,
} from "@/infrastructure/llm/prompts";
import {
  quizQuestionsSchema,
  evaluationSchema,
} from "@/infrastructure/llm/schemas";
import { studyRepo } from "@/infrastructure/db/repositories/study";
import {
  enqueueChapterLearnCache,
  getOrCreateLearnContent,
} from "./learn-cache";

export const studyService = {
  async learn(conceptId: string) {
    return getOrCreateLearnContent(conceptId);
  },

  async prefetchLearnContent(chapterId: string, excludeConceptId?: string) {
    return enqueueChapterLearnCache(chapterId, excludeConceptId);
  },

  async generateQuiz(chapterIds: string[], bloomLevel: number, count: number) {
    const concepts = await studyRepo.getConceptsByChapters(chapterIds);
    if (concepts.length === 0) return null;

    const parsed = await llmGateway.generateAndValidate(
      generateQuizPrompt(
        concepts.map((c) => ({ title: c.title, content: c.content })),
        bloomLevel,
        count
      ),
      { system: SYSTEM_PROMPT, schema: quizQuestionsSchema, retries: 2 }
    );
    const questions = parsed.questions.map(
      (q: { conceptTitle: string; question: string; bloomLevel: number; hints?: string[] }) => {
        const matched = concepts.find((c) => c.title === q.conceptTitle);
        return { ...q, hints: q.hints || [], conceptId: matched?.id || concepts[0].id };
      }
    );
    return { questions };
  },

  async evaluate(params: {
    sessionId?: string;
    conceptId: string;
    question: string;
    userAnswer: string;
    bloomLevel?: number;
  }) {
    const concept = await studyRepo.getConceptWithChapter(params.conceptId);
    if (!concept) return null;

    const evaluation = await llmGateway.generateAndValidate(
      evaluateAnswerPrompt(params.question, concept.content, params.userAnswer),
      { system: SYSTEM_PROMPT, schema: evaluationSchema, retries: 2 }
    );

    const score = Math.max(0, Math.min(5, evaluation.score));
    const bloomLevel = params.bloomLevel || 1;

    // Save quiz attempt
    if (params.sessionId) {
      await studyRepo.saveQuizAttempt({
        sessionId: params.sessionId,
        conceptId: params.conceptId,
        question: params.question,
        userAnswer: params.userAnswer,
        aiFeedback: evaluation.feedback,
        score,
        bloomLevel,
      });
    }

    // Update SM-2 progress
    const { sm2, consecutiveFails } = await studyRepo.updateProgress(
      params.conceptId,
      score,
      bloomLevel
    );

    return {
      ...evaluation,
      score,
      sm2,
      needsRelearning: sm2.easeFactor < 1.5 || consecutiveFails >= 2,
    };
  },

  async getReviewItems(projectId: string) {
    return studyRepo.getReviewItems(projectId);
  },
};
