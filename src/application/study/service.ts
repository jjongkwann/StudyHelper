import { llmGateway } from "@/infrastructure/llm/gateway";
import {
  learnConceptPrompt,
  generateQuizPrompt,
  evaluateAnswerPrompt,
  SYSTEM_PROMPT,
} from "@/infrastructure/llm/prompts";
import { studyRepo } from "@/infrastructure/db/repositories/study";

export const studyService = {
  async learn(conceptId: string) {
    const concept = await studyRepo.getConceptWithChapter(conceptId);
    if (!concept) return null;

    const response = await llmGateway.generate(
      learnConceptPrompt(
        `${concept.title}\n${concept.content}`,
        concept.chapter.rawContent
      ),
      { system: SYSTEM_PROMPT }
    );

    try {
      return JSON.parse(response);
    } catch {
      return { explanation: response, keyPoints: [], checkQuestion: null };
    }
  },

  async generateQuiz(chapterIds: string[], bloomLevel: number, count: number) {
    const concepts = await studyRepo.getConceptsByChapters(chapterIds);
    if (concepts.length === 0) return null;

    const response = await llmGateway.generate(
      generateQuizPrompt(
        concepts.map((c) => ({ title: c.title, content: c.content })),
        bloomLevel,
        count
      ),
      { system: SYSTEM_PROMPT }
    );

    const parsed = JSON.parse(response);
    const questions = parsed.questions.map(
      (q: { conceptTitle: string; question: string; bloomLevel: number; hints?: string[] }) => {
        const matched = concepts.find((c) => c.title === q.conceptTitle);
        return { ...q, conceptId: matched?.id || concepts[0].id };
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

    const response = await llmGateway.generate(
      evaluateAnswerPrompt(params.question, concept.content, params.userAnswer),
      { system: SYSTEM_PROMPT }
    );

    let evaluation;
    try {
      evaluation = JSON.parse(response);
    } catch {
      evaluation = { score: 0, feedback: response, correctAnswer: "", weakPoints: [] };
    }

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
