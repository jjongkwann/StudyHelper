import { userNoteRepo } from "@/infrastructure/db/repositories/user-note";

export const userNoteService = {
  async get(conceptId: string) {
    return userNoteRepo.get(conceptId);
  },

  async save(conceptId: string, userSummary: string) {
    if (!userSummary.trim()) {
      await userNoteRepo.delete(conceptId);
      return null;
    }
    return userNoteRepo.upsert(conceptId, userSummary.trim());
  },

  async delete(conceptId: string) {
    return userNoteRepo.delete(conceptId);
  },
};
