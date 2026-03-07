import { prisma } from "../prisma";
import type { LearnJobStatus } from "@/core/types";

export const learnJobRepo = {
  async enqueueMany(items: { conceptId: string; priority: number }[]) {
    if (items.length === 0) return { created: 0, reset: 0 };

    const conceptIds = items.map((item) => item.conceptId);
    const existingJobs = await prisma.learnJob.findMany({
      where: { conceptId: { in: conceptIds } },
      select: { conceptId: true, status: true },
    });

    const existingByConcept = new Map(
      existingJobs.map((job) => [job.conceptId, job.status])
    );

    const toCreate = items.filter((item) => !existingByConcept.has(item.conceptId));
    const toReset = items.filter((item) => {
      const status = existingByConcept.get(item.conceptId);
      return status === "failed" || status === "completed";
    });

    if (toCreate.length > 0) {
      await prisma.learnJob.createMany({
        data: toCreate.map((item) => ({
          conceptId: item.conceptId,
          priority: item.priority,
        })),
      });
    }

    for (const item of toReset) {
      await prisma.learnJob.update({
        where: { conceptId: item.conceptId },
        data: {
          status: "pending",
          priority: item.priority,
          error: null,
          endedAt: null,
        },
      });
    }

    return { created: toCreate.length, reset: toReset.length };
  },

  async findActiveByConceptId(conceptId: string) {
    return prisma.learnJob.findFirst({
      where: {
        conceptId,
        status: { in: ["pending", "running"] as LearnJobStatus[] },
      },
    });
  },

  async claimNextPending() {
    const job = await prisma.learnJob.findFirst({
      where: { status: "pending" },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      include: {
        concept: {
          include: {
            chapter: {
              select: { id: true, title: true, rawContent: true },
            },
          },
        },
      },
    });

    if (!job) return null;

    const claimed = await prisma.learnJob.updateMany({
      where: { id: job.id, status: "pending" },
      data: {
        status: "running",
        attempts: { increment: 1 },
        startedAt: new Date(),
        endedAt: null,
        error: null,
      },
    });

    if (claimed.count === 0) return null;

    return prisma.learnJob.findUnique({
      where: { id: job.id },
      include: {
        concept: {
          include: {
            chapter: {
              select: { id: true, title: true, rawContent: true },
            },
          },
        },
      },
    });
  },

  async complete(id: string) {
    return prisma.learnJob.update({
      where: { id },
      data: {
        status: "completed",
        error: null,
        endedAt: new Date(),
      },
    });
  },

  async fail(id: string, error: string) {
    return prisma.learnJob.update({
      where: { id },
      data: {
        status: "failed",
        error,
        endedAt: new Date(),
      },
    });
  },
};
