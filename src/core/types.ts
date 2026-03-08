// -- Project domain --

export type ProjectStatus = "pending" | "processing" | "ready" | "failed";

export type ImportStepName =
  | "validateInput"
  | "scanFiles"
  | "extractTopics"
  | "classifyFiles"
  | "buildChapters"
  | "validatePlan"
  | "analyzeChapter"
  | "persistChapter"
  | "finalize";

export type ImportJobStatus = "pending" | "running" | "completed" | "failed";
export type LearnJobStatus = "pending" | "running" | "completed" | "failed";

export interface ChapterPlan {
  title: string;
  description: string;
  order: number;
  files: string[];
}

export interface ConceptPlan {
  title: string;
  content: string;
  bloomLevel: number;
  order: number;
  kind?: "concept" | "support";
  prerequisites?: string[];
  estimatedMinutes?: number;
  assessable?: boolean;
  sourceSections?: string[];
}

// -- Workflow state passed between steps --

export interface TopicPlan {
  title: string;
  keywords: string[];
  order: number;
}

export interface FileAssignment {
  file: string;
  topic: string;
}

export interface ImportState {
  projectId: string;
  contentPath: string;
  basePath: string;
  /** All MD file paths found */
  mdFiles: string[];
  /** Syllabus file path (if found) */
  syllabusFile: string | null;
  /** Content files (non-underscore) */
  contentFiles: string[];
  /** Chain step 1 output: extracted topics */
  topics: TopicPlan[];
  /** Chain step 2 output: file→topic assignments */
  fileAssignments: FileAssignment[];
  /** AI-planned chapters */
  chapters: ChapterPlan[];
  /** Per-chapter analyzed concepts, keyed by chapter order */
  chapterConcepts: Record<number, ConceptPlan[]>;
  /** Tracks which chapters have been persisted (by order) */
  persistedChapters: number[];
  /** Current chapter index being processed */
  currentChapterIndex: number;
}

export function emptyImportState(projectId: string, contentPath: string, basePath: string): ImportState {
  return {
    projectId,
    contentPath,
    basePath,
    mdFiles: [],
    syllabusFile: null,
    contentFiles: [],
    topics: [],
    fileAssignments: [],
    chapters: [],
    chapterConcepts: {},
    persistedChapters: [],
    currentChapterIndex: 0,
  };
}
