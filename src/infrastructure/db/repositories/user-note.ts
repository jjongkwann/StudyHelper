import { prisma } from "../prisma";

export const userNoteRepo = {
  async get(conceptId: string) {
    return prisma.conceptUserNote.findUnique({ where: { conceptId } });
  },

  async upsert(conceptId: string, userSummary: string) {
    return prisma.conceptUserNote.upsert({
      where: { conceptId },
      create: { conceptId, userSummary },
      update: { userSummary },
    });
  },

  async delete(conceptId: string) {
    return prisma.conceptUserNote.deleteMany({ where: { conceptId } });
  },
};
