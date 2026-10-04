import { CHAPTER_BANK } from '../content/chapters';
import { extractChapterCode } from '../content/chapter-id';
import { milestoneByCode } from '../content/bank/milestones';
import { LaunchSession, LoutravoChapter, LoutravoError, ProgressResponse } from './loutravo.types';

const TWELVE_HOURS = 12 * 60 * 60 * 1000;

function chaptersFromCodes(codes?: string[]): LoutravoChapter[] {
  const wanted = (codes ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean);
  const source =
    wanted.length === 0
      ? CHAPTER_BANK
      : wanted
          .map(
            (code) =>
              CHAPTER_BANK.find((c) => c.code === code) ??
              CHAPTER_BANK.find((c) => extractChapterCode(c.title) === code),
          )
          .filter((c): c is (typeof CHAPTER_BANK)[number] => !!c);

  const list = source.length ? source : CHAPTER_BANK;
  return list.map((c, order) => {
    const chapter: LoutravoChapter = {
      id: c.id,
      title: c.title,
      order,
      code: c.code,
    };
    if (milestoneByCode(c.code)) {
      chapter.milestone = true;
    }
    return chapter;
  });
}

export class MockLoutravoBackend {
  private completed = new Set<string>();
  private started = new Set<string>();

  constructor(private readonly chapters: LoutravoChapter[]) {}

  static fromCodes(codes?: string[]): MockLoutravoBackend {
    return new MockLoutravoBackend(chaptersFromCodes(codes));
  }

  static fromSession(session: LaunchSession): MockLoutravoBackend {
    const backend = new MockLoutravoBackend(session.chapters.map((c) => ({ ...c })));
    backend.hydrate(session.completedChapterIds);
    return backend;
  }

  hydrate(completedChapterIds: string[]): void {
    this.completed = new Set(completedChapterIds);
    for (const id of completedChapterIds) {
      this.started.add(id);
    }
  }

  redeem(preview = false): LaunchSession {
    return this.snapshot('mock-session', preview);
  }

  report(sessionToken: string, chapterId: string, status: 'started' | 'completed'): ProgressResponse {
    if (sessionToken !== 'mock-session') {
      throw new LoutravoError(401, 'UNAUTHENTICATED', 'Session expirée. Relance cette activité depuis Loutravo.');
    }
    const index = this.chapters.findIndex((c) => c.id === chapterId);
    if (index < 0) {
      throw new LoutravoError(400, 'INVALID_ARGUMENT', 'Chapitre inconnu.');
    }
    for (let i = 0; i < index; i += 1) {
      const prev = this.chapters[i];
      if (prev && !this.completed.has(prev.id)) {
        throw new LoutravoError(409, 'FAILED_PRECONDITION', `Termine d’abord : ${prev.title}.`);
      }
    }
    if (status === 'started') {
      if (this.completed.has(chapterId)) {
        throw new LoutravoError(409, 'FAILED_PRECONDITION', 'Chapitre déjà terminé.');
      }
      this.started.add(chapterId);
    } else {
      this.completed.add(chapterId);
    }
    return this.progressPayload(chapterId, status);
  }

  private progressPayload(chapterId: string, status: 'started' | 'completed'): ProgressResponse {
    const completedChapterIds = this.chapters.filter((c) => this.completed.has(c.id)).map((c) => c.id);
    const next = this.chapters.find((c) => !this.completed.has(c.id));
    const assignmentStatus =
      completedChapterIds.length === 0
        ? 'assigned'
        : completedChapterIds.length === this.chapters.length
          ? 'completed'
          : 'in_progress';
    return {
      ok: true,
      appId: 'lab-opnsense',
      chapterId,
      status,
      assignmentStatus,
      currentChapterId: next?.id ?? chapterId,
      completedChapterIds,
    };
  }

  private snapshot(sessionToken: string, preview = false): LaunchSession {
    const completedChapterIds = this.chapters.filter((c) => this.completed.has(c.id)).map((c) => c.id);
    const next = this.chapters.find((c) => !this.completed.has(c.id));
    const assignmentStatus =
      completedChapterIds.length === 0
        ? 'assigned'
        : completedChapterIds.length === this.chapters.length
          ? 'completed'
          : 'in_progress';
    return {
      loutravoUid: 'mock-uid',
      appId: 'lab-opnsense',
      assignmentId: preview ? 'mock-preview' : 'mock-assign',
      sessionToken,
      expiresAt: Date.now() + TWELVE_HOURS,
      chapters: this.chapters.map((c) => ({ ...c })),
      currentChapterId: next?.id ?? null,
      completedChapterIds: preview ? [] : completedChapterIds,
      status: assignmentStatus,
      preview,
    };
  }
}

/** Instance par défaut (parcours complet) — les séances mock du service en créent une dédiée. */
export const mockBackend = MockLoutravoBackend.fromCodes();
