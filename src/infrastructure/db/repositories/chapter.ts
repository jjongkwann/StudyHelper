import { prisma } from "../prisma";
import type { ConceptPlan } from "@/core/types";

export const chapterRepo = {
  async createWithConcepts(data: {
    projectId: string;
    title: string;
    order: number;
    sourceFile: string;
    contentHash: string;
    rawContent: string;
    concepts: ConceptPlan[];
  }) {
    return prisma.$transaction(async (tx) => {
      return tx.chapter.create({
        data: {
          projectId: data.projectId,
          title: data.title,
          order: data.order,
          sourceFile: data.sourceFile,
          contentHash: data.contentHash,
          rawContent: data.rawContent,
          concepts: {
            create: data.concepts.map((c, idx) => ({
              title: c.title,
              content: c.content,
              bloomLevel: Math.min(6, Math.max(1, c.bloomLevel || 1)),
              order: c.order || idx + 1,
            })),
          },
        },
      });
    });
  },

  async deleteByProjectId(projectId: string) {
    return prisma.chapter.deleteMany({ where: { projectId } });
  },
};
