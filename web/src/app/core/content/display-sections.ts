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
import { ChapterSection } from './chapter.types';

export interface DisplaySection {
  key: string;
  kind: SectionKind;
  title: string;
  editable: boolean;
  paragraphs: string[];
  bullets: string[];
  commands: string[];
  schema?: string;
  callout?: ChapterSection['callout'];
  summary?: string;
  learningObjective?: string;
  duration?: string;
  part?: 'A' | 'B';
  checklist?: CheckItem[];
  flow?: DoFlowItem[];
  hints?: string[];
  quiz?: QuizQuestion[];
  files?: ResourceLink[];
}

export function sectionKindOf(section: ChapterSection): 'intro' | 'do' | 'see' | 'resources' {
  if (section.kind === 'do' || section.kind === 'see' || section.kind === 'intro' || section.kind === 'resources') {
    return section.kind;
  }
  const title = section.title.trim();
  if (title === SECTION_TITLE.do) {
    return 'do';
  }
  if (title === SECTION_TITLE.see) {
    return 'see';
  }
  if (title === SECTION_TITLE.resources) {
    return 'resources';
  }
  return 'intro';
}

export function displayTitle(kind: SectionKind, fallback: string): string {
  if (kind === 'do') {
    return SECTION_TITLE.do;
  }
  if (kind === 'see') {
    return SECTION_TITLE.see;
  }
  if (kind === 'objectives') {
    return SECTION_TITLE.objectives;
  }
  if (kind === 'deliverables') {
    return SECTION_TITLE.deliverables;
  }
  if (kind === 'resources') {
    return SECTION_TITLE.resources;
  }
  if (kind === 'quiz') {
    return SECTION_TITLE.quiz;
  }
  if (kind === 'know') {
    return SECTION_TITLE.know;
  }
  return fallback;
}

function cardToDisplay(card: LayoutCard, index: number): DisplaySection {
  return {
    key: `card:${index}`,
    kind: card.kind,
    title: displayTitle(card.kind, card.title),
    editable: true,
    paragraphs: [...card.paragraphs],
    bullets: [...card.bullets],
    commands: [...card.commands],
    schema: card.schema,
    callout: card.callout,
    summary: card.summary,
    learningObjective: card.learningObjective,
    duration: card.duration,
    part: card.part,
    checklist: card.checklist ? [...card.checklist] : undefined,
    flow: card.flow ? structuredClone(card.flow) : undefined,
    hints: card.hints ? [...card.hints] : undefined,
    quiz: card.quiz ? [...card.quiz] : undefined,
    files: card.files ? [...card.files] : undefined,
  };
}

export type DoViewBlock =
  | { type: 'text'; text: string }
  | { type: 'tasks'; items: CheckItem[] }
  | { type: 'commands'; texts: string[] }
  | { type: 'schema'; text: string }
  | { type: 'callout'; callout: NonNullable<ChapterSection['callout']> };

/** Groupes les cases et commandes consécutives pour l’affichage « À toi de faire ». */
export function groupedDoFlow(section: DisplaySection, fallbackCommands: string[] = []): DoViewBlock[] {
  const flow = section.flow?.length ? section.flow : legacyDoFlow(section, fallbackCommands);
  const blocks: DoViewBlock[] = [];
  for (const item of flow) {
    if (item.type === 'task') {
      const last = blocks.at(-1);
      if (last?.type === 'tasks') {
        last.items.push({ id: item.id, label: item.label });
      } else {
        blocks.push({ type: 'tasks', items: [{ id: item.id, label: item.label }] });
      }
      continue;
    }
    if (item.type === 'command') {
      const last = blocks.at(-1);
      if (last?.type === 'commands') {
        last.texts.push(item.text);
      } else {
        blocks.push({ type: 'commands', texts: [item.text] });
      }
      continue;
    }
    if (item.type === 'text') {
      blocks.push({ type: 'text', text: item.text });
      continue;
    }
    if (item.type === 'schema') {
      blocks.push({ type: 'schema', text: item.text });
      continue;
    }
    blocks.push({ type: 'callout', callout: item.callout });
  }
  return blocks;
}

function legacyDoFlow(section: DisplaySection, fallbackCommands: string[]): DoFlowItem[] {
  const items: DoFlowItem[] = [];
  for (const text of section.paragraphs) {
    items.push({ type: 'text', text });
  }
  if (section.schema) {
    items.push({ type: 'schema', text: section.schema });
  }
  if (section.callout) {
    items.push({ type: 'callout', callout: section.callout });
  }
  for (const item of section.checklist ?? []) {
    items.push({ type: 'task', id: item.id, label: item.label });
  }
  const commands = section.commands.length ? section.commands : fallbackCommands;
  for (const text of commands) {
    items.push({ type: 'command', text });
  }
  return items;
}

/**
 * Page chapitre selon la charte : Titre, Objectifs, Livrables, Ressources,
 * introductions, À toi de faire (répétable), Ce que tu dois voir (répétable), Quiz.
 */
export function buildDisplaySections(content: ChapterContent): DisplaySection[] {
  if (content.layout) {
    return content.layout.map(cardToDisplay);
  }

  const out: DisplaySection[] = [];

  out.push({
    key: 'title',
    kind: 'title',
    title: content.title,
    editable: true,
    paragraphs: [],
    bullets: [],
    commands: [],
    summary: content.summary,
    learningObjective: content.learningObjective,
    duration: content.duration,
    part: content.part,
  });

  out.push({
    key: 'objectives',
    kind: 'objectives',
    title: SECTION_TITLE.objectives,
    editable: true,
    paragraphs: [],
    bullets: [...content.objectives],
    commands: [],
  });

  out.push({
    key: 'deliverables',
    kind: 'deliverables',
    title: SECTION_TITLE.deliverables,
    editable: true,
    paragraphs: content.deliverable ? [content.deliverable] : [],
    bullets: [],
    commands: [],
  });

  out.push({
    key: 'resources',
    kind: 'resources',
    title: SECTION_TITLE.resources,
    editable: true,
    paragraphs: content.resources ? [content.resources] : [],
    bullets: [],
    commands: [],
    files: [...(content.resourceFiles ?? [])],
  });

  let hasDo = false;
  let hasSee = false;

  content.sections.forEach((sec, index) => {
    const kind = sectionKindOf(sec);
    if (kind === 'do') {
      hasDo = true;
    }
    if (kind === 'see') {
      hasSee = true;
    }
    if (kind === 'resources') {
      out.push({
        key: `sec:${index}`,
        kind: 'resources',
        title: SECTION_TITLE.resources,
        editable: true,
        paragraphs: [...(sec.paragraphs ?? [])],
        bullets: [...(sec.bullets ?? [])],
        commands: [...(sec.commands ?? [])],
        files: [...(sec.files ?? [])],
        schema: sec.schema,
        callout: sec.callout,
      });
      return;
    }
    out.push({
      key: `sec:${index}`,
      kind,
      title: displayTitle(kind, sec.title),
      editable: true,
      paragraphs: [...(sec.paragraphs ?? [])],
      bullets: [...(sec.bullets ?? [])],
      commands: [...(sec.commands ?? [])],
      schema: sec.schema,
      callout: sec.callout,
      files: sec.files ? [...sec.files] : undefined,
    });
  });

  if (!hasDo) {
    out.push({
      key: 'do',
      kind: 'do',
      title: SECTION_TITLE.do,
      editable: true,
      paragraphs: [],
      bullets: [],
      commands: [...content.commands],
      checklist: [...content.checklist],
      hints: [...content.hints],
    });
  } else {
    const firstDo = out.find((s) => s.kind === 'do');
    if (firstDo) {
      firstDo.checklist = [...content.checklist];
      firstDo.hints = [...content.hints];
      if (!firstDo.commands.length) {
        firstDo.commands = [...content.commands];
      }
    }
  }

  if (!hasSee) {
    out.push({
      key: 'see',
      kind: 'see',
      title: SECTION_TITLE.see,
      editable: true,
      paragraphs:
        content.vigilance.length === 0
          ? ['Tu contrôles sur la machine (nom, adresse, écran, dossier) — pas seulement une case cochée ici.']
          : [],
      bullets: [...content.vigilance],
      commands: [],
    });
  } else {
    const firstSee = out.find((s) => s.kind === 'see');
    if (firstSee && !firstSee.bullets.length && content.vigilance.length) {
      firstSee.bullets = [...content.vigilance];
    }
  }

  out.push({
    key: 'quiz',
    kind: 'quiz',
    title: SECTION_TITLE.quiz,
    editable: true,
    paragraphs: [],
    bullets: [],
    commands: [],
    quiz: content.quiz,
  });

  return out;
}

export function sectionToEditText(section: DisplaySection): string {
  switch (section.kind) {
    case 'title':
      return [section.summary ?? '', '', `À la fin, tu sauras… ${section.learningObjective ?? ''}`]
        .join('\n')
        .trimEnd();
    case 'objectives':
      return section.bullets.join('\n');
    case 'deliverables':
      return section.paragraphs.join('\n\n');
    case 'resources': {
      const lines = [...section.paragraphs];
      for (const file of section.files ?? []) {
        lines.push(`[Télécharger : ${file.label.replace(/[[\]]/g, '')}](${file.url})`);
      }
      return lines.join('\n\n').trim();
    }
    case 'quiz':
      return (section.quiz ?? [])
        .map((q, i) => {
          const choices = q.choices.map((c, n) => `  ${n === q.correctIndex ? '*' : '-'} ${c}`).join('\n');
          return `${i + 1}. ${q.prompt}\n${choices}\n  (${q.explain})`;
        })
        .join('\n\n');
    default: {
      const lines: string[] = [];
      if (section.kind === 'intro' && section.title) {
        lines.push(section.title, '');
      }
      if (section.kind === 'do' && section.flow?.length) {
        for (const item of section.flow) {
          if (item.type === 'text') {
            lines.push(item.text, '');
          } else if (item.type === 'task') {
            lines.push(`- ${item.label}`);
          } else if (item.type === 'command') {
            lines.push('`' + item.text + '`');
          } else if (item.type === 'schema') {
            lines.push('', '```', item.text, '```');
          } else if (item.type === 'callout') {
            lines.push('', `> ${item.callout.text}`);
          }
        }
        if (section.hints?.length) {
          lines.push('', 'Indices :');
          section.hints.forEach((h, i) => lines.push(`${i + 1}. ${h}`));
        }
        for (const file of section.files ?? []) {
          lines.push('', `[Télécharger : ${file.label.replace(/[[\]]/g, '')}](${file.url})`);
        }
        return lines.join('\n').trim();
      }
      for (const p of section.paragraphs) {
        lines.push(p, '');
      }
      for (const b of section.bullets) {
        lines.push(`- ${b}`);
      }
      if (section.checklist?.length) {
        if (lines.length && lines[lines.length - 1] !== '') {
          lines.push('');
        }
        for (const item of section.checklist) {
          lines.push(`- ${item.label}`);
        }
      }
      if (section.schema) {
        lines.push('', '```', section.schema, '```');
      }
      if (section.commands.length) {
        lines.push('');
        for (const cmd of section.commands) {
          lines.push('`' + cmd + '`');
        }
      }
      if (section.callout) {
        lines.push('', `> ${section.callout.text}`);
      }
      if (section.hints?.length) {
        lines.push('', 'Indices :');
        section.hints.forEach((h, i) => lines.push(`${i + 1}. ${h}`));
      }
      for (const file of section.files ?? []) {
        lines.push('', `[Télécharger : ${file.label.replace(/[[\]]/g, '')}](${file.url})`);
      }
      return lines.join('\n').trim();
    }
  }
}
