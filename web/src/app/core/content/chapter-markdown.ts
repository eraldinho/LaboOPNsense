import {
  ChapterContent,
  ChapterSection,
  CheckItem,
  DoFlowItem,
  LayoutCard,
  ResourceLink,
  SECTION_TITLE,
  SectionKind,
} from './chapter.types';
import { buildDisplaySections, DisplaySection, displayTitle, sectionToEditText } from './display-sections';
import { chapterFromDisplay, extractFileLinks, parseQuizText, patchLayoutCard, syncConvenienceFields } from './section-crud';

const OBJECTIVE_PREFIX = /(?:\*\*)?À la fin, tu sauras…(?:\*\*)?\s*/i;

/** Présent dans les overrides écrits par cette version : l’ordre des cartes est la source. */
export const LAYOUT_SENTINEL = '<!-- lab-opnsense.cards -->';

const HEADING_TO_KIND: Record<string, SectionKind> = {
  Objectifs: 'objectives',
  Livrables: 'deliverables',
  Ressources: 'resources',
  Introduction: 'intro',
  Explication: 'intro',
  'À savoir': 'know',
  'À toi de faire': 'do',
  'Ce que tu dois voir': 'see',
  Quiz: 'quiz',
};

export function chapterToMarkdown(content: ChapterContent): string {
  const sections = buildDisplaySections(content);
  return displaySectionsToMarkdown(sections);
}

export function displaySectionsToMarkdown(sections: DisplaySection[]): string {
  const parts: string[] = [LAYOUT_SENTINEL, ''];
  for (const section of sections) {
    appendDisplaySection(parts, section);
  }
  return `${parts.join('\n').trim()}\n`;
}

function appendDisplaySection(parts: string[], section: DisplaySection): void {
  if (section.kind === 'title') {
    parts.push(`# ${section.title}`, '');
    if (section.summary) {
      parts.push(section.summary, '');
    }
    if (section.learningObjective) {
      parts.push(`**À la fin, tu sauras…** ${section.learningObjective}`, '');
    }
    return;
  }

  const heading = displayTitle(section.kind, section.title);
  parts.push(`## ${heading}`, '');
  const body = sectionToMarkdownBody(section);
  if (body) {
    parts.push(body, '');
  }
}

function sectionToMarkdownBody(section: DisplaySection): string {
  if (section.kind === 'intro') {
    return sectionToEditText({ ...section, title: '' }).trim();
  }
  return sectionToEditText(section).trim();
}

interface ParsedBlock {
  title: string;
  body: string;
}

export function applyMarkdownOverride(base: ChapterContent, markdown: string): ChapterContent {
  const raw = String(markdown ?? '').replace(/\r\n/g, '\n').trim();
  if (!raw) {
    return structuredClone(base);
  }

  const custom = raw.startsWith(LAYOUT_SENTINEL);
  const text = custom ? raw.slice(LAYOUT_SENTINEL.length).trim() : raw;
  if (!text) {
    const empty = structuredClone(base);
    if (custom) {
      empty.layout = [];
      syncConvenienceFields(empty);
    }
    return empty;
  }

  if (custom) {
    return parseCustomLayout(base, text);
  }
  return parseLegacyOverride(base, text);
}

function parseCustomLayout(base: ChapterContent, text: string): ChapterContent {
  const next = structuredClone(base);
  const { preamble, blocks } = splitMarkdownBlocks(text);
  const layout: LayoutCard[] = [];

  const titleCard = titleCardFromPreamble(preamble, next.title);
  if (titleCard) {
    layout.push(titleCard);
  }

  for (const block of blocks) {
    layout.push(blockToLayoutCard(block, next));
  }

  next.layout = layout;
  syncConvenienceFields(next);
  return next;
}

function parseLegacyOverride(base: ChapterContent, text: string): ChapterContent {
  const next = structuredClone(base);
  const { preamble, blocks } = splitMarkdownBlocks(text);

  const titleCard = titleCardFromPreamble(preamble, next.title);
  if (titleCard) {
    if (titleCard.summary) {
      next.summary = titleCard.summary;
    }
    if (titleCard.learningObjective) {
      next.learningObjective = titleCard.learningObjective;
    }
  }

  const introSections: ChapterSection[] = [];
  let checklistTaken = false;
  let seeTaken = false;
  let resourcesTaken = false;

  for (const block of blocks) {
    const kind = HEADING_TO_KIND[block.title];
    if (kind === 'objectives') {
      const bullets = parseBullets(block.body);
      if (bullets.length) {
        next.objectives = bullets;
      }
      continue;
    }
    if (kind === 'deliverables') {
      const para = parseSectionBody(block.body).paragraphs.join('\n\n').trim();
      if (para) {
        next.deliverable = para;
      }
      continue;
    }
    if (kind === 'resources') {
      const parsed = parseResourcesBody(block.body);
      if (!resourcesTaken) {
        next.resources = parsed.paragraphs.join('\n\n');
        next.resourceFiles = parsed.files;
        resourcesTaken = true;
      } else {
        introSections.push({
          kind: 'resources',
          title: SECTION_TITLE.resources,
          paragraphs: parsed.paragraphs,
          files: parsed.files,
        });
      }
      continue;
    }
    if (kind === 'quiz') {
      const parsed = parseQuizText(block.body, next.quiz);
      if (parsed.length) {
        next.quiz = parsed;
      }
      continue;
    }
    if (kind === 'do' || block.title === SECTION_TITLE.do) {
      const parsed = parseSectionBody(block.body);
      if (!checklistTaken) {
        next.checklist = mergeChecklist(next.checklist, parsed.bullets);
        if (parsed.commands.length) {
          next.commands = parsed.commands;
        }
        if (parsed.hints.length) {
          next.hints = parsed.hints;
        }
        checklistTaken = true;
      } else {
        introSections.push({
          kind: 'do',
          title: SECTION_TITLE.do,
          paragraphs: parsed.paragraphs,
          bullets: parsed.bullets,
          commands: parsed.commands,
          schema: parsed.schema,
          callout: parsed.callout,
        });
      }
      continue;
    }
    if (kind === 'see' || block.title === SECTION_TITLE.see) {
      const parsed = parseSectionBody(block.body);
      if (!seeTaken) {
        next.vigilance = parsed.bullets.length ? parsed.bullets : parsed.paragraphs;
        seeTaken = true;
      } else {
        introSections.push({
          kind: 'see',
          title: SECTION_TITLE.see,
          paragraphs: parsed.paragraphs,
          bullets: parsed.bullets,
          commands: parsed.commands,
          schema: parsed.schema,
          callout: parsed.callout,
        });
      }
      continue;
    }

    const parsed = parseSectionBody(block.body);
    introSections.push({
      kind: 'intro',
      title: block.title,
      paragraphs: parsed.paragraphs,
      bullets: parsed.bullets,
      commands: parsed.commands,
      schema: parsed.schema,
      callout: parsed.callout,
      files: parsed.files,
    });
  }

  if (introSections.length) {
    next.sections = introSections;
  }
  return next;
}

function splitMarkdownBlocks(text: string): { preamble: string; blocks: ParsedBlock[] } {
  const lines = text.split('\n');
  let i = 0;
  const preamble: string[] = [];

  if (lines[0]?.startsWith('# ')) {
    preamble.push(lines[0]);
    i = 1;
  }
  while (i < lines.length && !lines[i].startsWith('## ')) {
    preamble.push(lines[i]);
    i += 1;
  }

  const blocks: ParsedBlock[] = [];
  while (i < lines.length) {
    const heading = lines[i].replace(/^##\s+/, '').trim();
    i += 1;
    const body: string[] = [];
    while (i < lines.length && !lines[i].startsWith('## ')) {
      body.push(lines[i]);
      i += 1;
    }
    blocks.push({ title: heading, body: body.join('\n').trim() });
  }

  return { preamble: preamble.join('\n').trim(), blocks };
}

function titleCardFromPreamble(preamble: string, fallbackTitle: string): LayoutCard | null {
  const text = preamble.trim();
  if (!text) {
    return null;
  }
  const heading = /^#\s+(.+)$/m.exec(text);
  const title = heading?.[1]?.trim() || fallbackTitle;
  const body = heading ? text.replace(/^#\s+.+\n?/, '').trim() : text;
  const objMatch = body.match(new RegExp(`${OBJECTIVE_PREFIX.source}([\\s\\S]*)$`, OBJECTIVE_PREFIX.flags));
  let summary = body;
  let learningObjective = '';
  if (objMatch && objMatch.index != null) {
    learningObjective = stripMarkdownBoldWrap(objMatch[1]);
    summary = body.slice(0, objMatch.index);
  }
  return {
    kind: 'title',
    title,
    paragraphs: [],
    bullets: [],
    commands: [],
    summary: stripTrailingMarkdownBold(summary),
    learningObjective,
  };
}

function stripMarkdownBoldWrap(text: string): string {
  return text.replace(/^\*{2}\s*|\s*\*{2}$/g, '').trim();
}

function stripTrailingMarkdownBold(text: string): string {
  return text.replace(/(\s*\*{2})+\s*$/g, '').trim();
}

function blockToLayoutCard(block: ParsedBlock, base: ChapterContent): LayoutCard {
  const mapped = HEADING_TO_KIND[block.title];
  const kind: SectionKind = mapped ?? 'intro';
  const parsed = kind === 'resources' ? parseResourcesBody(block.body) : parseSectionBody(block.body);
  const card: LayoutCard = {
    kind,
    title: displayTitle(kind, block.title),
    paragraphs: parsed.paragraphs,
    bullets: parsed.bullets,
    commands: parsed.commands,
    schema: parsed.schema,
    callout: parsed.callout,
    files: parsed.files,
  };

  if (kind === 'objectives') {
    card.bullets = parseBullets(block.body);
    card.paragraphs = [];
  }
  if (kind === 'deliverables') {
    card.paragraphs = parsed.paragraphs.length ? parsed.paragraphs : block.body ? [block.body] : [];
    card.bullets = [];
  }
  if (kind === 'do') {
    Object.assign(card, applyDoParsed(parsed, base.checklist));
  }
  if (kind === 'see' && !card.bullets.length && card.paragraphs.length) {
    card.bullets = [...card.paragraphs];
    card.paragraphs = [];
  }
  if (kind === 'quiz') {
    card.quiz = parseQuizText(block.body, base.quiz);
    card.paragraphs = [];
    card.bullets = [];
  }
  return card;
}

export function applySectionEdit(
  content: ChapterContent,
  section: DisplaySection,
  text: string,
): ChapterContent {
  const raw = text.replace(/\r\n/g, '\n');
  const source = content.layout ? content : chapterFromDisplay(content, buildDisplaySections(content));
  const display = buildDisplaySections(source);
  let index = display.findIndex((item) => item.key === section.key);
  if (index < 0) {
    index = display.findIndex((item) => item.kind === section.kind && item.title === section.title);
  }
  if (index >= 0 && source.layout) {
    const patch = textToLayoutPatch(section.kind, raw, source.layout[index]);
    return patchLayoutCard(source, index, patch);
  }
  const cardMatch = /^card:(\d+)$/.exec(section.key);
  if (cardMatch && content.layout) {
    const cardIndex = Number(cardMatch[1]);
    const patch = textToLayoutPatch(section.kind, raw, content.layout[cardIndex]);
    return patchLayoutCard(content, cardIndex, patch);
  }

  const next = structuredClone(content);

  switch (section.key) {
    case 'title': {
      const parsed = parseTitleEdit(raw);
      next.summary = parsed.summary;
      if (parsed.learningObjective != null) {
        next.learningObjective = parsed.learningObjective;
      }
      return next;
    }
    case 'objectives':
      next.objectives = raw
        .split('\n')
        .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
        .filter(Boolean);
      return next;
    case 'deliverables':
      next.deliverable = raw.trim();
      return next;
    case 'resources': {
      const parsed = parseResourcesBody(raw);
      next.resources = parsed.paragraphs.join('\n\n');
      next.resourceFiles = parsed.files;
      return next;
    }
    case 'quiz':
      next.quiz = parseQuizText(raw, next.quiz);
      return next;
    case 'do': {
      const parsed = parseSectionBody(raw);
      next.checklist = mergeChecklist(next.checklist, parsed.bullets.length ? parsed.bullets : parsed.paragraphs);
      if (parsed.commands.length) {
        next.commands = parsed.commands;
      }
      if (parsed.hints.length) {
        next.hints = parsed.hints;
      }
      return next;
    }
    case 'see': {
      const parsed = parseSectionBody(raw);
      next.vigilance = parsed.bullets.length ? parsed.bullets : parsed.paragraphs;
      return next;
    }
    default: {
      const match = /^sec:(\d+)$/.exec(section.key);
      if (!match) {
        return next;
      }
      const index = Number(match[1]);
      const parsed = parseSectionBody(raw);
      const kind =
        section.kind === 'do' || section.kind === 'see' || section.kind === 'resources' ? section.kind : 'intro';
      let title = section.title;
      if (kind === 'intro') {
        const firstLine = raw.split('\n')[0]?.trim() ?? '';
        if (firstLine && !firstLine.startsWith('-') && !firstLine.startsWith('>') && !firstLine.startsWith('```')) {
          const rest = raw.split('\n').slice(1).join('\n').trim();
          const restParsed = parseSectionBody(rest);
          next.sections[index] = {
            kind: 'intro',
            title: firstLine,
            paragraphs: restParsed.paragraphs,
            bullets: restParsed.bullets,
            commands: restParsed.commands,
            schema: restParsed.schema,
            callout: restParsed.callout,
            files: restParsed.files,
          };
          return next;
        }
      }
      next.sections[index] = {
        kind,
        title,
        paragraphs: parsed.paragraphs,
        bullets: parsed.bullets,
        commands: parsed.commands,
        schema: parsed.schema,
        callout: parsed.callout,
        files: parsed.files,
      };
      return next;
    }
  }
}

function parseTitleEdit(raw: string): { summary: string; learningObjective?: string } {
  const match = raw.match(OBJECTIVE_PREFIX);
  if (match && match.index != null) {
    return {
      summary: stripTrailingMarkdownBold(raw.slice(0, match.index)),
      learningObjective: stripMarkdownBoldWrap(raw.slice(match.index + match[0].length)),
    };
  }
  return { summary: stripTrailingMarkdownBold(raw) };
}

function textToLayoutPatch(kind: SectionKind, raw: string, current?: LayoutCard): Partial<LayoutCard> {
  if (kind === 'title') {
    return parseTitleEdit(raw);
  }
  if (kind === 'objectives') {
    return {
      bullets: raw
        .split('\n')
        .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
        .filter(Boolean),
      paragraphs: [],
    };
  }
  if (kind === 'deliverables') {
    return { paragraphs: raw.trim() ? [raw.trim()] : [], bullets: [] };
  }
  if (kind === 'resources') {
    const parsed = parseResourcesBody(raw);
    return { paragraphs: parsed.paragraphs, files: parsed.files, bullets: [] };
  }
  if (kind === 'quiz') {
    return { quiz: parseQuizText(raw, current?.quiz ?? []), paragraphs: [], bullets: [] };
  }
  const parsed = parseSectionBody(raw);
  const patch: Partial<LayoutCard> = {
    paragraphs: parsed.paragraphs,
    bullets: parsed.bullets,
    commands: parsed.commands,
    schema: parsed.schema,
    callout: parsed.callout,
    files: parsed.files,
  };
  if (kind === 'intro') {
    const firstLine = raw.split('\n')[0]?.trim() ?? '';
    if (firstLine && !firstLine.startsWith('-') && !firstLine.startsWith('>') && !firstLine.startsWith('```')) {
      const rest = raw.split('\n').slice(1).join('\n').trim();
      const restParsed = parseSectionBody(rest);
      return {
        title: firstLine,
        paragraphs: restParsed.paragraphs,
        bullets: restParsed.bullets,
        commands: restParsed.commands,
        schema: restParsed.schema,
        callout: restParsed.callout,
        files: restParsed.files,
      };
    }
  }
  if (kind === 'do') {
    return { ...patch, ...applyDoParsed(parsed, current?.checklist ?? []) };
  }
  return patch;
}

function applyDoParsed(parsed: ParsedBody, existing: CheckItem[]): Partial<LayoutCard> {
  const hasBullets = parsed.blocks.some((block) => block.type === 'bullet');
  const draft: DoFlowItem[] = [];
  const labels: string[] = [];

  for (const block of parsed.blocks) {
    if (block.type === 'bullet' || (block.type === 'paragraph' && !hasBullets)) {
      labels.push(block.text);
      draft.push({ type: 'task', id: '', label: block.text });
      continue;
    }
    if (block.type === 'paragraph') {
      draft.push({ type: 'text', text: block.text });
      continue;
    }
    if (block.type === 'command') {
      draft.push({ type: 'command', text: block.text });
      continue;
    }
    if (block.type === 'schema') {
      draft.push({ type: 'schema', text: block.text });
      continue;
    }
    draft.push({ type: 'callout', callout: block.callout });
  }

  const checklist = mergeChecklist(existing, labels);
  let taskIndex = 0;
  const flow = draft.map((item) => {
    if (item.type !== 'task') {
      return item;
    }
    const check = checklist[taskIndex];
    taskIndex += 1;
    return { type: 'task' as const, id: check.id, label: check.label };
  });

  const schemas = flow.filter((item): item is Extract<DoFlowItem, { type: 'schema' }> => item.type === 'schema');
  const calloutItem = flow.find((item): item is Extract<DoFlowItem, { type: 'callout' }> => item.type === 'callout');

  return {
    flow,
    checklist,
    paragraphs: flow
      .filter((item): item is Extract<DoFlowItem, { type: 'text' }> => item.type === 'text')
      .map((item) => item.text),
    bullets: [],
    commands: flow
      .filter((item): item is Extract<DoFlowItem, { type: 'command' }> => item.type === 'command')
      .map((item) => item.text),
    schema: schemas.length ? schemas.map((item) => item.text).join('\n\n') : undefined,
    callout: calloutItem?.callout,
    hints: parsed.hints,
  };
}

function mergeChecklist(existing: CheckItem[], labels: string[]): CheckItem[] {
  const pool = [...existing];
  const usedIds = new Set<string>();
  return labels.map((label, i) => {
    const found = pool.findIndex((item) => item.label === label);
    if (found >= 0) {
      const [item] = pool.splice(found, 1);
      usedIds.add(item.id);
      return { id: item.id, label };
    }
    let n = i + 1;
    let id = `edit-${n}`;
    while (usedIds.has(id) || existing.some((item) => item.id === id)) {
      n += 1;
      id = `edit-${n}`;
    }
    usedIds.add(id);
    return { id, label };
  });
}

function parseBullets(body: string): string[] {
  return body
    .split('\n')
    .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean);
}

type BodyBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'command'; text: string }
  | { type: 'schema'; text: string }
  | { type: 'callout'; callout: NonNullable<ChapterSection['callout']> };

interface ParsedBody {
  paragraphs: string[];
  bullets: string[];
  commands: string[];
  schema?: string;
  callout?: ChapterSection['callout'];
  hints: string[];
  files: ResourceLink[];
  blocks: BodyBlock[];
}

function parseResourcesBody(body: string): ParsedBody {
  const { text, files } = extractFileLinks(body);
  const parsed = parseSectionBody(text);
  parsed.files = [...parsed.files, ...files];
  return parsed;
}

function parseSectionBody(body: string): ParsedBody {
  const extracted = extractFileLinks(body);
  const lines = extracted.text.replace(/\r\n/g, '\n').split('\n');
  const paragraphs: string[] = [];
  const bullets: string[] = [];
  const commands: string[] = [];
  const blocks: BodyBlock[] = [];
  const hints: string[] = [];
  let schema: string | undefined;
  let callout: ChapterSection['callout'] | undefined;
  let i = 0;
  let hintMode = false;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (/^indices\s*:?\s*$/i.test(line.trim())) {
      hintMode = true;
      i += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) {
        i += 1;
      }
      const text = buf.join('\n');
      schema = text;
      blocks.push({ type: 'schema', text });
      continue;
    }
    if (line.startsWith('>')) {
      const text = line.replace(/^>\s?/, '').trim();
      callout = { type: 'info', text };
      blocks.push({ type: 'callout', callout });
      i += 1;
      continue;
    }
    if (hintMode && /^\s*\d+\.\s+/.test(line)) {
      hints.push(line.replace(/^\s*\d+\.\s+/, '').trim());
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, '').trim();
      bullets.push(text);
      blocks.push({ type: 'bullet', text });
      i += 1;
      continue;
    }
    if (/^`[^`]+`$/.test(line.trim())) {
      const text = line.trim().slice(1, -1);
      commands.push(text);
      blocks.push({ type: 'command', text });
      i += 1;
      continue;
    }
    const para = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('>') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^`[^`]+`$/.test(lines[i].trim()) &&
      !/^indices\s*:?\s*$/i.test(lines[i].trim())
    ) {
      para.push(lines[i]);
      i += 1;
    }
    const text = para.join('\n').trim();
    paragraphs.push(text);
    blocks.push({ type: 'paragraph', text });
  }

  return { paragraphs, bullets, commands, schema, callout, hints, files: extracted.files, blocks };
}
