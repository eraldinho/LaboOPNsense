import { DisplaySection, groupedDoFlow } from '../core/content/display-sections';
import { isSafeHref, splitInline } from './md-inline';

/** Endroit cliquable, dans l’ordre d’affichage du chapitre, de haut en bas. */
export interface ChapterClickTarget {
  order: number;
  sectionKey: string;
  paragraphIndex?: number;
  partIndex?: number;
  fileIndex?: number;
  checkId?: string;
}

/**
 * Rang des liens de la section Ressources et des cases « À toi de faire ».
 * Une image ou un lien dont l’adresse est refusée ne prend pas de rang.
 * Les fichiers affichés dans « À toi de faire » ne sont pas suivis.
 */
export function chapterClickTargets(
  sections: readonly DisplaySection[],
  fallbackCommands: string[] = [],
): ChapterClickTarget[] {
  const targets: ChapterClickTarget[] = [];
  for (const section of sections) {
    if (section.kind === 'resources') {
      section.paragraphs.forEach((paragraph, paragraphIndex) => {
        let partIndex = 0;
        for (const part of splitInline(paragraph)) {
          if ((part.type === 'link' || part.type === 'file') && isSafeHref(part.url)) {
            targets.push({
              order: targets.length,
              sectionKey: section.key,
              paragraphIndex,
              partIndex,
            });
            partIndex += 1;
          }
        }
      });
      (section.files ?? []).forEach((_file, fileIndex) => {
        targets.push({
          order: targets.length,
          sectionKey: section.key,
          fileIndex,
        });
      });
      continue;
    }
    if (section.kind !== 'do') continue;
    for (const block of groupedDoFlow(section, fallbackCommands)) {
      if (block.type !== 'tasks') continue;
      for (const item of block.items) {
        targets.push({
          order: targets.length,
          sectionKey: section.key,
          checkId: item.id,
        });
      }
    }
  }
  return targets;
}
