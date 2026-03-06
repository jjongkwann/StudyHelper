export interface AIProvider {
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
}

export interface GenerateOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface QuizQuestion {
  question: string;
  bloomLevel: number;
  conceptId: string;
}

export interface QuizEvaluation {
  score: number; // 0-5
  feedback: string;
  correctAnswer: string;
  weakPoints: string[];
}

export interface ChapterSummary {
  concepts: {
    title: string;
    keyPoints: string[];
    bloomLevel: number;
  }[];
}
