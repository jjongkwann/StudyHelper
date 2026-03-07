import { prisma } from "../prisma";

export const annotationRepo = {
  async create(data: {
    conceptId: string;
    selectedText: string;
    note?: string;
    color?: string;
  }) {
    return prisma.conceptAnnotation.create({
      data: {
        conceptId: data.conceptId,
        selectedText: data.selectedText,
        note: data.note ?? null,
        color: data.color ?? "yellow",
      },
    });
  },

  async update(id: string, data: { note?: string; color?: string }) {
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
      orderBy: { createdAt: "desc" },
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
