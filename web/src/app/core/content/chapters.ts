import { ChapterContent, ChapterSeed } from './chapter.types';
import { extractChapterCode, inferPart, isTechnicalChapterLabel, slugify, stripLeadingChapterCode } from './chapter-id';
import { PART_A } from './bank/part-a';
import { PART_B } from './bank/part-b';
import { PEDAGOGY } from './bank/pedagogy';

export { chapterListTitle, extractChapterCode, inferPart, slugify } from './chapter-id';

function oneLiner(seed: ChapterSeed): string {
  const first = seed.objectives[0] ?? seed.summary;
  const rest = first.charAt(0).toLowerCase() + first.slice(1);
  return rest.replace(/\.+$/, '');
}

function finalize(seed: ChapterSeed): ChapterContent {
  const extra = PEDAGOGY[seed.code];
  return {
    ...seed,
    learningObjective: extra?.learningObjective ?? seed.learningObjective ?? oneLiner(seed),
    hints: extra?.hints ?? seed.hints ?? [],
    resources: seed.resources ?? '',
    resourceFiles: seed.resourceFiles ?? [],
  };
}

export const CHAPTER_BANK: ChapterContent[] = [...PART_A, ...PART_B].map(finalize);

export const LOUTRAVO_TITLES: string[] = CHAPTER_BANK.map((c) => c.title);

/**
 * Aligne une entrée Loutravo (id généré par le hub + titre) sur la fiche locale.
 * Pas de repli sur l’index : un parcours partiel (sous-ensemble) casserait le mapping.
 */
export function findContent(chapterId: string, title: string): ChapterContent | undefined {
  const byId = CHAPTER_BANK.find((c) => c.id === chapterId);
  if (byId) {
    return byId;
  }
  const label = String(title ?? '').trim();
  const stripped = stripLeadingChapterCode(label, extractChapterCode(label));
  const want = slugify(label);
  const wantStripped = slugify(stripped);
  const byTitle = CHAPTER_BANK.find((c) => {
    const card = stripLeadingChapterCode(c.title, c.code);
    return (
      c.title === label ||
      card === label ||
      card === stripped ||
      slugify(c.title) === want ||
      slugify(card) === wantStripped ||
      slugify(c.title) === slugify(chapterId)
    );
  });
  if (byTitle) {
    return byTitle;
  }
  const codeFromTitle = extractChapterCode(label);
  if (codeFromTitle) {
    return CHAPTER_BANK.find((c) => c.code.toUpperCase() === codeFromTitle);
  }
  return undefined;
}

/** Fiche vide pour un chapitre hub sans contenu bundlé : éditable en aperçu. */
export function emptyChapterContent(opts: { id: string; title: string; code?: string }): ChapterContent {
  const title = String(opts.title ?? '').trim() || 'Chapitre';
  const code =
    String(opts.code ?? '').trim().toUpperCase() || extractChapterCode(title) || extractChapterCode(opts.id) || '';
  return {
    id: opts.id,
    code,
    title,
    part: inferPart(code) ?? inferPart(title) ?? 'A',
    duration: '',
    summary: '',
    learningObjective: '',
    hints: [],
    objectives: [],
    sections: [],
    vigilance: [],
    deliverable: '',
    resources: '',
    resourceFiles: [],
    commands: [],
    checklist: [],
    quiz: [],
    layout: [],
  };
}

export function contentPart(chapterId: string, title: string, content?: ChapterContent): 'A' | 'B' | undefined {
  return content?.part ?? inferPart(title) ?? inferPart(chapterId);
}

/**
 * Le titre affiché est celui de Loutravo (liste admin). La fiche bundlée sert au corps,
 * pas au libellé. Ne mute pas CHAPTER_BANK.
 */
export function applyHubTitle(
  content: ChapterContent | undefined,
  hubTitle: string | undefined,
  hubCode?: string,
): ChapterContent | undefined {
  if (!content) {
    return undefined;
  }
  const title = String(hubTitle ?? '').trim();
  const code = String(hubCode ?? '').trim().toUpperCase();
  const usableTitle = title && !isTechnicalChapterLabel(title, content.id) ? title : '';
  const layoutCard = content.layout?.find((c) => c.kind === 'title');
  const titleSame = !usableTitle || (content.title === usableTitle && (!layoutCard || layoutCard.title === usableTitle));
  const codeSame = !code || content.code === code;
  if (titleSame && codeSame) {
    return content;
  }
  const next = structuredClone(content);
  if (usableTitle) {
    next.title = usableTitle;
    const card = next.layout?.find((c) => c.kind === 'title');
    if (card) {
      card.title = usableTitle;
    }
  }
  if (code) {
    next.code = code;
  }
  return next;
}
