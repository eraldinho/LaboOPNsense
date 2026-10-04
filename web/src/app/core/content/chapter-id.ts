/** Identifiants de chapitre : slug Loutravo, préfixe A0–B11, sans dépendre du hub. */

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extrait un numéro de chapitre depuis un titre (« A5 — … », « B0 … ») ou un id slug.
 * Ne suppose pas un nombre fixe de chapitres.
 */
export function extractChapterCode(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.normalize('NFD').replace(/\p{M}/gu, '').trim();
  const fromTitle = trimmed.match(/^([A-Za-z]{1,3}\d{1,3}|\d{1,3})\b/);
  if (fromTitle?.[1]) {
    return fromTitle[1].toUpperCase();
  }
  const slug = slugify(trimmed);
  const fromSlug = slug.match(/(?:^|-)((?:a|b)\d+)(?=-|$)/);
  if (fromSlug?.[1]) {
    return fromSlug[1].toUpperCase();
  }
  return undefined;
}

export function stripLeadingChapterCode(title: string, code?: string): string {
  const trimmed = title.trim();
  const token = (code ?? '').trim();
  if (!token || !trimmed) {
    return trimmed;
  }
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripped = trimmed.replace(new RegExp(`^${escaped}(?:\\s*[—–\\-:\\t]\\s*|\\s+)`, 'i'), '').trim();
  return stripped || trimmed;
}

export function isTechnicalChapterLabel(label: string | undefined, id: string | undefined): boolean {
  const text = String(label ?? '').trim();
  const key = String(id ?? '').trim();
  if (!text) {
    return true;
  }
  if (!key) {
    return false;
  }
  if (text === key) {
    return true;
  }
  if (/\s/.test(text)) {
    return false;
  }
  const a = slugify(text);
  const b = slugify(key);
  return a === b || b.endsWith(`-${a}`);
}

function humanizeChapterId(id: string, code?: string): string {
  let raw = id.trim();
  const token = (code ?? '').trim().toLowerCase();
  if (token && raw.toLowerCase().startsWith(token)) {
    raw = raw.slice(token.length).replace(/^-+/, '');
  } else {
    raw = raw.replace(/^[a-z]{1,3}\d{1,3}-/i, '');
  }
  const words = raw.replace(/-/g, ' ').trim();
  if (!words) {
    return id;
  }
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Titre blanc du parcours : titre hub, sinon fiche, jamais l’id slug. */
export function chapterListTitle(opts: {
  id: string;
  hubTitle?: string;
  contentTitle?: string;
  code?: string;
}): string {
  const code = opts.code;
  const candidates = [opts.hubTitle, opts.contentTitle];
  for (const raw of candidates) {
    const stripped = stripLeadingChapterCode(String(raw ?? ''), code);
    if (stripped && !isTechnicalChapterLabel(stripped, opts.id) && !isTechnicalChapterLabel(raw, opts.id)) {
      return stripped;
    }
  }
  return humanizeChapterId(opts.id, code);
}

export function resolveChapterCode(opts: {
  hubCode?: string | null;
  title?: string;
  bundled?: string;
  id?: string;
  fallback?: string;
}): string {
  return (
    (opts.hubCode ?? '').trim().toUpperCase() ||
    extractChapterCode(opts.title) ||
    extractChapterCode(opts.id) ||
    (opts.bundled ?? '').trim().toUpperCase() ||
    opts.fallback ||
    ''
  );
}

export function inferPart(codeOrTitle: string | undefined): 'A' | 'B' | undefined {
  const code = extractChapterCode(codeOrTitle);
  if (!code) {
    return undefined;
  }
  return code.startsWith('B') ? 'B' : 'A';
}
