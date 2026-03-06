import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "이름은 필수입니다"),
  slug: z.string().min(1, "slug는 필수입니다").regex(/^[a-z0-9가-힣-]+$/, "slug는 소문자, 숫자, 한글, 하이픈만 허용됩니다"),
  description: z.string().optional(),
  contentPath: z.string().min(1, "콘텐츠 경로는 필수입니다"),
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
