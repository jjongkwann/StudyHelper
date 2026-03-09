import { prisma } from "../prisma";
import type { ConceptPlan } from "@/core/types";

function conceptKey(title: string): string {
  return title
    .replace(/^\d+\s*[\.\)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export const chapterRepo = {
  async upsertWithConcepts(data: {
    projectId: string;
    title: string;
    order: number;
    sourceFile: string;
    contentHash: string;
    rawContent: string;
    concepts: ConceptPlan[];
  }) {
    return prisma.$transaction(async (tx) => {
      const existingChapter = await tx.chapter.findFirst({
        where: {
          projectId: data.projectId,
          order: data.order,
        },
        include: {
          concepts: {
            orderBy: { order: "asc" },
          },
        },
      });

      const chapter = existingChapter
        ? await tx.chapter.update({
            where: { id: existingChapter.id },
            data: {
              title: data.title,
              sourceFile: data.sourceFile,
              contentHash: data.contentHash,
              rawContent: data.rawContent,
            },
          })
        : await tx.chapter.create({
            data: {
              projectId: data.projectId,
              title: data.title,
              order: data.order,
              sourceFile: data.sourceFile,
              contentHash: data.contentHash,
              rawContent: data.rawContent,
            },
          });

      const existingConcepts = existingChapter?.concepts ?? [];
      const usedConceptIds = new Set<string>();
      const normalizedConcepts = data.concepts.map((concept, idx) => ({
        title: concept.title,
        content: concept.content,
        bloomLevel: Math.min(6, Math.max(1, concept.bloomLevel || 1)),
        order: concept.order || idx + 1,
      }));

      for (const concept of normalizedConcepts) {
        const matchedByTitle = existingConcepts.find((existing) =>
          !usedConceptIds.has(existing.id)
          && conceptKey(existing.title) === conceptKey(concept.title)
        );
        const matched = matchedByTitle;

        if (matched) {
          usedConceptIds.add(matched.id);
          await tx.concept.update({
            where: { id: matched.id },
            data: {
              title: concept.title,
              content: concept.content,
              bloomLevel: concept.bloomLevel,
              order: concept.order,
            },
          });
          continue;
        }

        await tx.concept.create({
          data: {
            chapterId: chapter.id,
            title: concept.title,
            content: concept.content,
            bloomLevel: concept.bloomLevel,
            order: concept.order,
          },
        });
      }

      const staleConceptIds = existingConcepts
        .filter((concept) => !usedConceptIds.has(concept.id))
        .map((concept) => concept.id);

      if (staleConceptIds.length > 0) {
        await tx.concept.deleteMany({
          where: {
            id: { in: staleConceptIds },
          },
        });
      }

      return chapter;
    });
  },

  async deleteMissingByProjectId(projectId: string, keepOrders: number[]) {
    return prisma.chapter.deleteMany({
      where: {
        projectId,
        order: { notIn: keepOrders },
      },
    });
  },

  async deleteByProjectId(projectId: string) {
    return prisma.chapter.deleteMany({ where: { projectId } });
  },
};
