import { annotationRepo } from "@/infrastructure/db/repositories/annotation";

export const annotationService = {
  async create(data: {
    conceptId: string;
    type: "highlight" | "memo";
    selectedText: string;
    note?: string;
    color?: string;
    startOffset?: number;
    endOffset?: number;
  }) {
    return annotationRepo.create(data);
  },

  async update(id: string, data: { note?: string | null; color?: string }) {
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
