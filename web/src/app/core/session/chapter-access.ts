export function isPreviewFlag(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function isTestChapter(chapter: { id: string; title?: string; test?: boolean }): boolean {
  if (chapter.test === true) return true;
  return /^Test\b/.test((chapter.title ?? '').trim());
}

export interface ChapterAccess {
  id: string;
  completed: boolean;
  playable: boolean;
  locked: boolean;
  /** Prochain chapitre, et c’est un test que le professeur n’a pas débloqué. */
  testLocked: boolean;
}

/**
 * Élève : un seul chapitre jouable (le premier non terminé), les suivants verrouillés.
 * Un chapitre test reste fermé tant que le professeur ne l’a pas débloqué pour cet élève.
 * Aperçu professeur : tout est ouvert, aucun verrou séquentiel.
 */
export function chapterAccess(
  chapters: { id: string; order: number; title?: string; test?: boolean }[],
  completedIds: string[],
  preview: boolean,
  testsUnlocked = false,
): ChapterAccess[] {
  const completed = new Set(completedIds);
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  const firstIncomplete = sorted.findIndex((chapter) => !completed.has(chapter.id));
  return sorted.map((chapter, index) => {
    const done = completed.has(chapter.id);
    if (preview) {
      return { id: chapter.id, completed: done, playable: true, locked: false, testLocked: false };
    }
    const isNext = index === firstIncomplete;
    const testLocked = isNext && isTestChapter(chapter) && !testsUnlocked;
    const playable = isNext && !testLocked;
    return {
      id: chapter.id,
      completed: done,
      playable,
      locked: !done && !playable,
      testLocked,
    };
  });
}
