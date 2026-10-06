import {
  ChapterContent,
  CheckItem,
  DoFlowItem,
  LayoutCard,
  QuizQuestion,
  ResourceLink,
  SECTION_TITLE,
  SectionKind,
} from './chapter.types';
import { DisplaySection } from './display-sections';

export function emptyDisplaySection(kind: SectionKind, chapterTitle = ''): DisplaySection {
  const title =
    kind === 'title'
      ? chapterTitle || 'Titre'
      : kind === 'intro'
        ? 'Introduction'
        : kind === 'do'
          ? SECTION_TITLE.do
          : kind === 'see'
            ? SECTION_TITLE.see
            : SECTION_TITLE[kind as Exclude<SectionKind, 'title' | 'intro'>];

  const base: DisplaySection = {
    key: `new:${kind}:${Date.now()}`,
    kind,
    title,
    editable: true,
    paragraphs: [],
    bullets: [],
    commands: [],
  };

  if (kind === 'title') {
    base.summary = '';
    base.learningObjective = '';
  }
  if (kind === 'resources') {
    base.files = [];
  }
  if (kind === 'do') {
    base.checklist = [];
    base.flow = [];
    base.hints = [];
  }
  if (kind === 'quiz') {
    base.quiz = [];
  }
  return base;
}

export function insertSectionAt(
  sections: DisplaySection[],
  index: number,
  kind: SectionKind,
  chapterTitle = '',
): DisplaySection[] {
  const next = [...sections];
  const clamped = Math.max(0, Math.min(index, next.length));
  next.splice(clamped, 0, emptyDisplaySection(kind, chapterTitle));
  return next;
}

export function removeSectionAt(sections: DisplaySection[], index: number): DisplaySection[] {
  if (index < 0 || index >= sections.length) {
    return sections;
  }
  return sections.filter((_, i) => i !== index);
}

/** Avant la précédente (`delta: -1`) ou après la suivante (`delta: 1`). */
export function moveSectionAt(sections: DisplaySection[], index: number, delta: number): DisplaySection[] {
  const next = [...sections];
  const target = index + delta;
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) {
    return sections;
  }
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

export function layoutFromDisplay(sections: DisplaySection[]): LayoutCard[] {
  return sections.map((section) => ({
    kind: section.kind,
    title: section.title,
    paragraphs: [...section.paragraphs],
    bullets: [...section.bullets],
    commands: [...section.commands],
    schema: section.schema,
    callout: section.callout,
    files: section.files ? [...section.files] : undefined,
    checklist: section.checklist ? [...section.checklist] : undefined,
    flow: section.flow ? structuredClone(section.flow) : undefined,
    hints: section.hints ? [...section.hints] : undefined,
    quiz: section.quiz ? [...section.quiz] : undefined,
    summary: section.summary,
    learningObjective: section.learningObjective,
    duration: section.duration,
    part: section.part,
  }));
}

export function chapterFromDisplay(base: ChapterContent, sections: DisplaySection[]): ChapterContent {
  const next: ChapterContent = structuredClone(base);
  next.layout = layoutFromDisplay(sections);
  syncConvenienceFields(next);
  return next;
}

export function syncConvenienceFields(content: ChapterContent): void {
  const layout = content.layout;
  if (!layout) {
    return;
  }

  const title = layout.find((c) => c.kind === 'title');
  if (title) {
    if (title.summary != null) {
      content.summary = title.summary;
    }
    if (title.learningObjective != null) {
      content.learningObjective = title.learningObjective;
    }
    if (title.title?.trim()) {
      content.title = title.title;
    }
  }

  const objectives = layout.find((c) => c.kind === 'objectives');
  content.objectives = objectives ? [...objectives.bullets] : [];

  const deliverables = layout.find((c) => c.kind === 'deliverables');
  content.deliverable = deliverables ? deliverables.paragraphs.join('\n\n') : '';

  const resources = layout.find((c) => c.kind === 'resources');
  content.resources = resources ? resources.paragraphs.join('\n\n') : '';
  content.resourceFiles = resources?.files ? [...resources.files] : [];

  const body = layout.filter(
    (c) => c.kind === 'intro' || c.kind === 'do' || c.kind === 'see' || c.kind === 'resources',
  );
  content.sections = body
    .filter((c) => c.kind !== 'resources')
    .map((c) => ({
      kind: c.kind as 'intro' | 'do' | 'see',
      title: c.title,
      paragraphs: [...c.paragraphs],
      bullets: [...c.bullets],
      commands: [...c.commands],
      schema: c.schema,
      callout: c.callout,
      files: c.files,
    }));

  const firstDo = layout.find((c) => c.kind === 'do');
  if (firstDo) {
    const flowTasks =
      firstDo.flow
        ?.filter((item): item is Extract<DoFlowItem, { type: 'task' }> => item.type === 'task')
        .map((item) => ({ id: item.id, label: item.label })) ?? [];
    content.checklist = flowTasks.length
      ? flowTasks
      : mergeChecklist(content.checklist, checklistLabels(firstDo));
    content.hints = firstDo.hints ? [...firstDo.hints] : [];
    const flowCommands = firstDo.flow
      ?.filter((item): item is Extract<DoFlowItem, { type: 'command' }> => item.type === 'command')
      .map((item) => item.text);
    content.commands = flowCommands?.length ? flowCommands : [...firstDo.commands];
  } else {
    content.checklist = [];
    content.hints = [];
    content.commands = [];
  }

  const firstSee = layout.find((c) => c.kind === 'see');
  content.vigilance = firstSee
    ? firstSee.bullets.length
      ? [...firstSee.bullets]
      : [...firstSee.paragraphs]
    : [];

  const quiz = layout.find((c) => c.kind === 'quiz');
  content.quiz = quiz?.quiz ? [...quiz.quiz] : [];
}

function checklistLabels(card: LayoutCard): string[] {
  const fromFlow =
    card.flow
      ?.filter((item): item is Extract<DoFlowItem, { type: 'task' }> => item.type === 'task')
      .map((item) => item.label) ?? [];
  if (fromFlow.length) {
    return fromFlow;
  }
  if (card.checklist?.length) {
    return card.checklist.map((item) => item.label);
  }
  return card.bullets.length ? card.bullets : card.paragraphs;
}

function mergeChecklist(existing: CheckItem[], labels: string[]): CheckItem[] {
  return labels.map((label, i) => ({
    id: existing[i]?.id ?? `edit-${i + 1}`,
    label,
  }));
}

export function patchLayoutCard(content: ChapterContent, index: number, patch: Partial<LayoutCard>): ChapterContent {
  const next = structuredClone(content);
  if (!next.layout || index < 0 || index >= next.layout.length) {
    return next;
  }
  next.layout[index] = { ...next.layout[index], ...patch };
  syncConvenienceFields(next);
  return next;
}

export function parseQuizText(text: string, existing: QuizQuestion[] = []): QuizQuestion[] {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n\s*\n/);
  const out: QuizQuestion[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trimEnd());
    if (!lines.length) {
      continue;
    }
    const promptLine = lines[0].replace(/^\s*\d+\.\s*/, '').trim();
    if (!promptLine) {
      continue;
    }
    const choices: string[] = [];
    let correctIndex = 0;
    let explain = '';
    for (const line of lines.slice(1)) {
      const star = /^\s*\*\s+(.+)$/.exec(line);
      const dash = /^\s*[-]\s+(.+)$/.exec(line);
      const expl = /^\s*\((.+)\)\s*$/.exec(line);
      if (star) {
        correctIndex = choices.length;
        choices.push(star[1].trim());
      } else if (dash) {
        choices.push(dash[1].trim());
      } else if (expl) {
        explain = expl[1].trim();
      }
    }
    if (choices.length < 2) {
      continue;
    }
    const prev = existing[out.length];
    out.push({
      id: prev?.id ?? `q-edit-${out.length + 1}`,
      prompt: promptLine,
      choices,
      correctIndex: Math.min(correctIndex, choices.length - 1),
      explain: explain || prev?.explain || 'Regarde le chapitre et réessaie.',
    });
  }
  return out;
}

export function extractFileLinks(text: string): { text: string; files: ResourceLink[] } {
  const files: ResourceLink[] = [];
  const cleaned = text.replace(
    /\[Télécharger\s*:\s*([^\]]+)\]\(([^)\s]+)\)/gi,
    (_m, label: string, url: string) => {
      files.push({ label: String(label).trim() || 'fichier', url: String(url).trim() });
      return '';
    },
  );
  return { text: cleaned.replace(/\n{3,}/g, '\n\n').trim(), files };
}

export function fileLinksToMarkdown(files: ResourceLink[] | undefined): string {
  if (!files?.length) {
    return '';
  }
  return files.map((f) => `[Télécharger : ${f.label.replace(/[[\]]/g, '')}](${f.url})`).join('\n');
}
