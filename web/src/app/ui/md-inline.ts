export type InlinePart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; alt: string }
  | { type: 'file'; url: string; label: string }
  | { type: 'link'; url: string; label: string };

const TOKEN_RE =
  /(!\[([^\]]*)\]\((https?:[^)\s]+)\))|(\[Télécharger\s*:\s*([^\]]+)\]\((https?:[^)\s]+|\/[^)\s]+)\))|(\[([^\]]+)\]\((https?:[^)\s]+|\/[^)\s]+)\))/gi;

export function splitInline(text: string): InlinePart[] {
  const source = String(text ?? '');
  if (!source) {
    return [];
  }
  const parts: InlinePart[] = [];
  let last = 0;
  const re = new RegExp(TOKEN_RE.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    if (match.index > last) {
      parts.push({ type: 'text', text: source.slice(last, match.index) });
    }
    if (match[1]) {
      parts.push({ type: 'image', alt: match[2] ?? '', url: match[3] });
    } else if (match[4]) {
      parts.push({ type: 'file', label: match[5]?.trim() || 'fichier', url: match[6] });
    } else if (match[7]) {
      const label = match[8] ?? '';
      const url = match[9] ?? '';
      if (/^Télécharger\s*:/i.test(label)) {
        parts.push({ type: 'file', label: label.replace(/^Télécharger\s*:\s*/i, '').trim() || 'fichier', url });
      } else {
        parts.push({ type: 'link', label, url });
      }
    }
    last = match.index + match[0].length;
  }
  if (last < source.length) {
    parts.push({ type: 'text', text: source.slice(last) });
  }
  return parts.length ? parts : [{ type: 'text', text: source }];
}

export interface SeeBlock {
  type: 'paragraph' | 'image' | 'list';
  text: string;
  items: string[];
}

/** Une ligne qui ne contient qu’une image markdown, sans texte autour. */
export function isStandaloneImage(text: string): boolean {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    return false;
  }
  const parts = splitInline(trimmed);
  return parts.length > 0 && parts.every((part) => part.type === 'image' || (part.type === 'text' && !part.text.trim()));
}

/**
 * « Ce que tu dois voir » range souvent chaque ligne dans une puce.
 * Une image seule reste une image, à sa place, et non une puce de texte.
 */
export function buildSeeBlocks(paragraphs: string[], bullets: string[]): SeeBlock[] {
  const blocks: SeeBlock[] = [];
  const list: string[] = [];
  const flush = () => {
    if (!list.length) {
      return;
    }
    blocks.push({ type: 'list', text: '', items: [...list] });
    list.length = 0;
  };

  const consume = (text: string, asParagraph: boolean) => {
    const lines = String(text ?? '').split('\n');
    if (!lines.some((line) => isStandaloneImage(line))) {
      flush();
      const value = String(text ?? '');
      if (!value.trim()) {
        return;
      }
      if (asParagraph) {
        blocks.push({ type: 'paragraph', text: value, items: [] });
      } else {
        list.push(value);
      }
      return;
    }
    for (const line of lines) {
      if (!line.trim()) {
        flush();
        continue;
      }
      if (isStandaloneImage(line)) {
        flush();
        blocks.push({ type: 'image', text: line.trim(), items: [] });
      } else if (asParagraph) {
        flush();
        blocks.push({ type: 'paragraph', text: line.trim(), items: [] });
      } else {
        list.push(line.trim());
      }
    }
  };

  for (const paragraph of paragraphs) {
    consume(paragraph, true);
  }
  for (const bullet of bullets) {
    consume(bullet, false);
  }
  flush();
  return blocks;
}

export function isSafeHref(url: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
