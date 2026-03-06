import { prisma } from "../prisma";
import type { ImportStepName, ImportJobStatus } from "@/core/types";

export const importJobRepo = {
  async create(projectId: string, step: ImportStepName) {
    return prisma.importJob.create({
      data: { projectId, step, status: "pending" },
    });
  },

  async start(id: string, payload?: unknown) {
    return prisma.importJob.update({
      where: { id },
      data: {
        status: "running",
        payload: payload ? JSON.stringify(payload) : null,
        startedAt: new Date(),
      },
    });
  },

  async complete(id: string, result?: unknown) {
    return prisma.importJob.update({
      where: { id },
      data: {
        status: "completed",
        result: result ? JSON.stringify(result) : null,
        endedAt: new Date(),
      },
    });
  },

  async fail(id: string, error: string) {
    return prisma.importJob.update({
      where: { id },
      data: {
        status: "failed",
        error,
        endedAt: new Date(),
      },
    });
  },

  async getLatestByProject(projectId: string) {
    return prisma.importJob.findMany({
      where: { projectId },
      orderBy: { startedAt: "desc" },
    });
  },

  async getLastCompleted(projectId: string): Promise<{ step: string; result: string | null } | null> {
    return prisma.importJob.findFirst({
      where: { projectId, status: "completed" },
      orderBy: { startedAt: "desc" },
      select: { step: true, result: true },
    });
  },

  async getLastFailed(projectId: string) {
    return prisma.importJob.findFirst({
      where: { projectId, status: "failed" },
      orderBy: { startedAt: "desc" },
    });
  },

  async deleteByProject(projectId: string) {
    return prisma.importJob.deleteMany({ where: { projectId } });
  },
};
