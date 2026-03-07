import { prisma } from "../prisma";
import type { ProjectStatus } from "@/core/types";

export const projectRepo = {
  async create(data: {
    name: string;
    slug: string;
    description?: string;
    contentPath: string;
  }) {
    return prisma.project.create({
      data: { ...data, status: "pending" },
    });
  },

  async findBySlug(slug: string) {
    return prisma.project.findUnique({ where: { slug } });
  },

  async findById(id: string) {
    return prisma.project.findUnique({ where: { id } });
  },

  async update(
    id: string,
    data: {
      name: string;
      description?: string;
    }
  ) {
    return prisma.project.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
      },
    });
  },

  async delete(id: string) {
    return prisma.project.delete({
      where: { id },
    });
  },

  async updateStatus(
    id: string,
    status: ProjectStatus,
    extra?: { importStep?: string | null; importProgress?: number | null; errorMessage?: string | null }
  ) {
    return prisma.project.update({
      where: { id },
      data: {
        status,
        importStep: extra?.importStep ?? null,
        importProgress: extra?.importProgress ?? null,
        errorMessage: extra?.errorMessage ?? null,
      },
    });
  },

  async listWithStats() {
    const projects = await prisma.project.findMany({
      include: {
        chapters: {
          include: {
            concepts: {
              include: { studyProgress: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return projects.map((project) => {
      const totalConcepts = project.chapters.reduce(
        (sum, ch) => sum + ch.concepts.length, 0
      );
      const learnedConcepts = project.chapters.reduce(
        (sum, ch) =>
          sum + ch.concepts.filter((c) => c.studyProgress.some((p) => p.mastery >= 3)).length,
        0
      );
      const reviewDue = project.chapters.reduce(
        (sum, ch) =>
          sum + ch.concepts.filter((c) =>
            c.studyProgress.some((p) => p.nextReviewAt && p.nextReviewAt <= new Date())
          ).length,
        0
      );

      return {
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description,
        status: project.status,
        importStep: project.importStep,
        importProgress: project.importProgress,
        errorMessage: project.errorMessage,
        chapterCount: project.chapters.length,
        totalConcepts,
        learnedConcepts,
        reviewDue,
        progress: totalConcepts > 0 ? Math.round((learnedConcepts / totalConcepts) * 100) : 0,
        createdAt: project.createdAt,
      };
    });
  },

  async getDetail(slug: string) {
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        chapters: {
          orderBy: { order: "asc" },
          include: {
            concepts: {
              orderBy: { order: "asc" },
              include: { studyProgress: true },
            },
          },
        },
      },
    });

    if (!project) return null;

    const chaptersWithStats = project.chapters.map((chapter) => {
      const totalConcepts = chapter.concepts.length;
      const learnedConcepts = chapter.concepts.filter((c) =>
        c.studyProgress.some((p) => p.mastery >= 3)
      ).length;
      const reviewDue = chapter.concepts.filter((c) =>
        c.studyProgress.some((p) => p.nextReviewAt && p.nextReviewAt <= new Date())
      ).length;
      const needsRelearning = chapter.concepts.filter((c) =>
        c.studyProgress.some((p) => p.easeFactor < 1.5 || p.consecutiveFails >= 2)
      ).length;

      return {
        id: chapter.id,
        title: chapter.title,
        order: chapter.order,
        sourceFile: chapter.sourceFile,
        conceptCount: totalConcepts,
        learnedConcepts,
        reviewDue,
        needsRelearning,
        progress: totalConcepts > 0 ? Math.round((learnedConcepts / totalConcepts) * 100) : 0,
        concepts: chapter.concepts.map((c) => ({
          id: c.id,
          title: c.title,
          bloomLevel: c.bloomLevel,
          order: c.order,
          progress: c.studyProgress[0] || null,
        })),
      };
    });

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      status: project.status,
      chapters: chaptersWithStats,
    };
  },
};
