import { prisma } from "../prisma";

export const annotationRepo = {
  async create(data: {
    conceptId: string;
    type: "highlight" | "memo";
    selectedText: string;
    note?: string;
    color?: string;
    startOffset?: number;
    endOffset?: number;
  }) {
    return prisma.conceptAnnotation.create({
      data: {
        conceptId: data.conceptId,
        type: data.type,
        selectedText: data.selectedText,
        note: data.note ?? null,
        color: data.color ?? "yellow",
        startOffset: data.startOffset,
        endOffset: data.endOffset,
      },
    });
  },

  async update(id: string, data: { note?: string | null; color?: string }) {
    return prisma.conceptAnnotation.update({
      where: { id },
      data,
    });
  },

  async delete(id: string) {
    return prisma.conceptAnnotation.delete({ where: { id } });
  },

  async listByConcept(conceptId: string) {
    return prisma.conceptAnnotation.findMany({
      where: { conceptId },
      orderBy: [{ startOffset: "asc" }, { createdAt: "asc" }],
    });
  },

  async listByProject(projectSlug: string) {
    return prisma.conceptAnnotation.findMany({
      where: {
        concept: { chapter: { project: { slug: projectSlug } } },
      },
      include: {
        concept: {
          select: {
            id: true,
            title: true,
            order: true,
            chapter: {
              select: { id: true, title: true, order: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
