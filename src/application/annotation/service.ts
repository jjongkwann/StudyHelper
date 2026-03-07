import { annotationRepo } from "@/infrastructure/db/repositories/annotation";

export const annotationService = {
  async create(data: {
    conceptId: string;
    selectedText: string;
    note?: string;
    color?: string;
  }) {
    return annotationRepo.create(data);
  },

  async update(id: string, data: { note?: string; color?: string }) {
    return annotationRepo.update(id, data);
  },

  async delete(id: string) {
    return annotationRepo.delete(id);
  },

  async listByConcept(conceptId: string) {
    return annotationRepo.listByConcept(conceptId);
  },

  async listByProject(projectSlug: string) {
    return annotationRepo.listByProject(projectSlug);
  },
};
