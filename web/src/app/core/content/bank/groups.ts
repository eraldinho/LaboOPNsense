import { ChapterContent } from '../chapter.types';
import { extractChapterCode } from '../chapter-id';
import { hubMilestoneDef, MilestoneDef, milestoneByCode, milestoneFromTitleOrId } from './milestones';

export interface GroupableChapter {
  id: string;
  title: string;
  /** Numéro jaune Loutravo (A5, B7…) — le titre n’a plus forcément le préfixe. */
  code?: string;
  content?: ChapterContent;
  /** `milestone: true` renvoyé par redeemLaunch. */
  hubMilestone?: boolean;
  milestoneTitle?: string;
  milestoneRecap?: string;
}

export interface ChapterGroup<T extends GroupableChapter = GroupableChapter> {
  id: string;
  items: T[];
  milestone?: MilestoneDef;
  part: 'A' | 'B' | 'mix';
}

export function chapterMilestone<T extends GroupableChapter>(ch: T): MilestoneDef | undefined {
  const bundled =
    milestoneByCode(ch.content?.code) ?? milestoneByCode(ch.code) ?? milestoneFromTitleOrId(ch.title, ch.id);
  if (!ch.hubMilestone && !bundled) {
    return undefined;
  }
  if (!ch.hubMilestone) {
    return bundled;
  }
  const fallback = bundled ?? hubMilestoneDef(ch.code);
  const title = ch.milestoneTitle?.trim();
  const recap = ch.milestoneRecap?.trim();
  return {
    code: fallback.code,
    shortTitle: title || fallback.shortTitle,
    recap: recap || fallback.recap,
  };
}

function groupPart<T extends GroupableChapter>(items: T[]): 'A' | 'B' | 'mix' {
  const parts = new Set(
    items.map((ch) => ch.content?.part ?? (extractChapterCode(ch.title)?.startsWith('B') ? 'B' : 'A')),
  );
  if (parts.size === 1) {
    return [...parts][0] === 'B' ? 'B' : 'A';
  }
  return 'mix';
}

/** Découpe la liste attribuée (quel que soit N) en groupes fermés par un jalon. */
export function groupByMilestones<T extends GroupableChapter>(chapters: T[]): ChapterGroup<T>[] {
  const groups: ChapterGroup<T>[] = [];
  let bucket: T[] = [];

  const flush = (milestone?: MilestoneDef) => {
    if (!bucket.length) {
      return;
    }
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    groups.push({
      id: `g-${first?.id ?? 'x'}-${last?.id ?? 'y'}`,
      items: bucket,
      milestone,
      part: groupPart(bucket),
    });
    bucket = [];
  };

  for (const ch of chapters) {
    bucket.push(ch);
    const milestone = chapterMilestone(ch);
    if (milestone) {
      flush(milestone);
    }
  }
  flush();
  return groups;
}
