import { projectRepo } from "@/infrastructure/db/repositories/project";
import { runImportWorkflow, retryImportWorkflow } from "@/workflows/import-project";

export const projectService = {
  async list() {
    return projectRepo.listWithStats();
  },

  async getDetail(slug: string) {
    return projectRepo.getDetail(slug);
  },

  async getStatus(slug: string) {
    const project = await projectRepo.findBySlug(slug);
    if (!project) return null;
    return {
      id: project.id,
      status: project.status,
      importStep: project.importStep,
      importProgress: project.importProgress,
      errorMessage: project.errorMessage,
    };
  },

  /** Create project and start background import. Returns immediately. */
  async create(data: { name: string; slug: string; description?: string; contentPath: string }) {
    const project = await projectRepo.create(data);

    // Fire-and-forget background import
    runImportWorkflow(project.id).catch((err) => {
      console.error("Background import error:", err);
    });

    return {
      id: project.id,
      slug: project.slug,
      status: "pending" as const,
    };
  },

  async update(
    slug: string,
    data: { name: string; description?: string }
  ) {
    const project = await projectRepo.findBySlug(slug);
    if (!project) return { error: "not_found" as const };

    const updated = await projectRepo.update(project.id, data);
    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      description: updated.description,
    };
  },

  async delete(slug: string) {
    const project = await projectRepo.findBySlug(slug);
    if (!project) return { error: "not_found" as const };
    if (project.status === "pending" || project.status === "processing") {
      return { error: "busy" as const };
    }

    await projectRepo.delete(project.id);
    return { ok: true as const };
  },

  /** Re-run import for an existing project without deleting the project itself */
  async retry(slug: string) {
    const project = await projectRepo.findBySlug(slug);
    if (!project) return { error: "not_found" as const };
    if (project.status === "pending" || project.status === "processing") {
      return { error: "busy" as const };
    }

    const mode = project.status === "failed" ? "retry" : "refresh";

    await projectRepo.updateStatus(project.id, "pending", {
      importStep: mode === "retry" ? "재시도 준비 중..." : "재정리 준비 중...",
      importProgress: 0,
      errorMessage: null,
    });

    retryImportWorkflow(project.id).catch((err) => {
      console.error("Retry import error:", err);
    });

    return {
      id: project.id,
      slug: project.slug,
      status: "pending" as const,
      mode,
    };
  },
};
