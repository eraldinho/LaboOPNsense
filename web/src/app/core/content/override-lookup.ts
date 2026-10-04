import { ChapterContent } from './chapter.types';
import { findContent } from './chapters';

export function isUsableMarkdown(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Plus tard gagne, mais une chaîne vide n’écrase pas un texte déjà là. */
export function mergeOverrideMaps(...maps: Array<Record<string, string> | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const map of maps) {
    if (!map) {
      continue;
    }
    for (const [key, value] of Object.entries(map)) {
      if (isUsableMarkdown(value)) {
        out[key] = value;
      }
    }
  }
  return out;
}

/**
 * Le calque professeur peut être rangé sous l’id Loutravo du moment, l’id bundlé,
 * ou le code (A0). Un renommage admin ne doit pas le faire disparaître.
 */
export function pickOverrideMarkdown(
  overrides: Record<string, string>,
  chapterId: string,
  bundled?: ChapterContent,
): string | undefined {
  for (const key of chapterAliasKeys(chapterId, bundled)) {
    const markdown = overrides[key];
    if (isUsableMarkdown(markdown)) {
      return markdown;
    }
  }

  const targetId = bundled?.id ?? findContent(chapterId, chapterId)?.id;
  if (!targetId) {
    return undefined;
  }
  for (const [key, markdown] of Object.entries(overrides)) {
    if (!isUsableMarkdown(markdown)) {
      continue;
    }
    const found = findContent(key, key);
    if (found?.id === targetId) {
      return markdown;
    }
  }
  return undefined;
}

export function chapterAliasKeys(chapterId: string, bundled?: ChapterContent): string[] {
  return [...new Set([chapterId, bundled?.id, bundled?.code, bundled?.code?.toLowerCase()].filter((key): key is string => !!key))];
}

export function pickWorkingCopy(
  copies: Record<string, ChapterContent>,
  chapterId: string,
  bundled?: ChapterContent,
): ChapterContent | undefined {
  for (const key of chapterAliasKeys(chapterId, bundled)) {
    if (copies[key]) {
      return copies[key];
    }
  }
  return undefined;
}

export function aliasOverrideMarkdown(
  chapterId: string,
  bundled: ChapterContent | undefined,
  markdown: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isUsableMarkdown(markdown)) {
    return out;
  }
  for (const key of chapterAliasKeys(chapterId, bundled)) {
    out[key] = markdown;
  }
  return out;
}
