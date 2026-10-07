export interface LoutravoChapter {
  id: string;
  title: string;
  order: number;
  /** Numéro jaune du parcours (A0, B1…), géré dans Loutravo. */
  code?: string;
  /** Jalon pédagogique posé dans Admin → Parcours. */
  milestone?: boolean;
  milestoneTitle?: string;
  milestoneRecap?: string;
  /** Chapitre test : fermé tant que le professeur ne l’a pas débloqué. */
  test?: boolean;
}

export type AssignmentStatus = 'assigned' | 'in_progress' | 'completed';

export interface LaunchSession {
  loutravoUid: string;
  appId: string;
  assignmentId: string;
  sessionToken: string;
  expiresAt: number;
  chapters: LoutravoChapter[];
  currentChapterId: string | null;
  completedChapterIds: string[];
  status: AssignmentStatus;
  /** Aperçu professeur (`startPreview` → redeemLaunch). Navigation libre, pas d’avancement élève. */
  preview?: boolean;
  /** Le professeur a débloqué les chapitres test pour cet élève. */
  testsUnlocked?: boolean;
  /** Cases, choix de quiz et quiz déjà juste, pour rouvrir l’activité. */
  work?: LearnerWork | null;
  /** Brouillon de test déjà enregistré sur Loutravo, s’il y en a un. */
  testDraft?: RemoteTestDraft | null;
}

export interface LearnerWork {
  checklists: Record<string, string[]>;
  quizzes: Record<string, Record<string, number>>;
  quizPassed: Record<string, boolean>;
  updatedAt: number;
}

export interface QuizAttemptReport {
  chapterId: string;
  questionId: string;
  prompt: string;
  answer: string;
  correct: boolean;
  at: number;
  order?: number;
}

export interface RemoteTestDraft {
  names?: Record<string, string>;
  markers?: Record<string, Array<{ x: number; y: number } | null>>;
  ports?: Record<string, { name?: string; utility?: string }>;
}

export interface ProgressResponse {
  ok: true;
  appId: string;
  chapterId: string;
  status: 'started' | 'completed';
  assignmentStatus: AssignmentStatus;
  currentChapterId: string | null;
  completedChapterIds: string[];
  testsUnlocked?: boolean;
}

export interface SessionSnapshot {
  testsUnlocked: boolean;
  currentChapterId: string | null;
  completedChapterIds: string[];
  status: AssignmentStatus;
  preview?: boolean;
  work?: LearnerWork | null;
  testDraft?: RemoteTestDraft | null;
}

export interface LoutravoErrorBody {
  error?: {
    status?: string;
    message?: string;
  };
}

export class LoutravoError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LoutravoError';
  }

  get needsRelaunch(): boolean {
    return this.httpStatus === 401 || this.httpStatus === 410 || this.code === 'UNAUTHENTICATED';
  }
}
