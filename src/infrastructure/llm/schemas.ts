import { z } from "zod";

// -- planChapters chain schemas --

export const extractTopicsSchema = z.object({
  topics: z.array(
    z.object({
      title: z.string(),
      keywords: z.array(z.string()),
      order: z.number(),
    })
  ),
});

export const classifyFilesSchema = z.object({
  assignments: z.array(
    z.object({
      file: z.string(),
      topic: z.string(),
    })
  ),
});

export const chapterOrganizationSchema = z.object({
  chapters: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional().default(""),
      order: z.number(),
      files: z.array(z.string()),
    })
  ),
});

export const conceptOutlineSchema = z.object({
  outline: z.array(
    z.object({
      fileIndex: z.number(),
      sectionTitle: z.string(),
      learningOrder: z.number(),
      bloomLevel: z.number().min(1).max(6),
      mergeWithPrevious: z.boolean().optional(),
    })
  ),
});

export const conceptAnalysisSchema = z.object({
  concepts: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
      bloomLevel: z.number().min(1).max(6).default(1),
      order: z.number(),
    })
  ),
});

export const learnContentSchema = z.object({
  explanation: z.string(),
  keyPoints: z.array(z.string()).default([]),
  analogy: z.string().optional(),
  checkQuestion: z.object({
    question: z.string(),
    expectedAnswer: z.string(),
  }).nullable().optional(),
});

export const quizQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      bloomLevel: z.number().min(1).max(6),
      conceptTitle: z.string(),
      hints: z.array(z.string()).optional().default([]),
    })
  ),
});

export const evaluationSchema = z.object({
  score: z.number().min(0).max(5),
  feedback: z.string(),
  correctAnswer: z.string(),
  weakPoints: z.array(z.string()).default([]),
});

export const createProjectSchema = z.object({
  name: z.string().min(1, "이름은 필수입니다"),
  slug: z
    .string()
    .min(1, "slug는 필수입니다")
    .regex(/^[a-z0-9가-힣-]+$/, "slug는 소문자, 숫자, 한글, 하이픈만 허용됩니다"),
  description: z.string().optional(),
  contentPath: z.string().min(1, "콘텐츠 경로는 필수입니다"),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, "이름은 필수입니다"),
  description: z.string().optional(),
});
