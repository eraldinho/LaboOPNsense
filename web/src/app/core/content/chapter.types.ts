export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explain: string;
}

export interface CheckItem {
  id: string;
  label: string;
}

export interface ResourceLink {
  label: string;
  url: string;
}

/** Types de cartes de la charte des activités guidées Loutravo. */
export type SectionKind =
  | 'title'
  | 'objectives'
  | 'deliverables'
  | 'resources'
  | 'intro'
  | 'know'
  | 'do'
  | 'see'
  | 'quiz';

/** Titres figés de la charte. « À toi de faire », « Ce que tu dois voir » et « À savoir » ne se traduisent pas. */
export const SECTION_TITLE: Record<Exclude<SectionKind, 'title' | 'intro'>, string> = {
  objectives: 'Objectifs',
  deliverables: 'Livrables',
  resources: 'Ressources',
  know: 'À savoir',
  do: 'À toi de faire',
  see: 'Ce que tu dois voir',
  quiz: 'Quiz',
};

export const SECTION_PICKER: { kind: SectionKind; label: string }[] = [
  { kind: 'title', label: 'Titre' },
  { kind: 'objectives', label: 'Objectifs' },
  { kind: 'deliverables', label: 'Livrables' },
  { kind: 'resources', label: 'Ressources' },
  { kind: 'intro', label: 'Introduction' },
  { kind: 'know', label: SECTION_TITLE.know },
  { kind: 'do', label: SECTION_TITLE.do },
  { kind: 'see', label: SECTION_TITLE.see },
  { kind: 'quiz', label: 'Quiz' },
];

export interface ChapterSection {
  title: string;
  /** Corps pédagogique : intro par défaut. do / see / resources peuvent se répéter. */
  kind?: 'intro' | 'do' | 'see' | 'resources';
  paragraphs?: string[];
  bullets?: string[];
  commands?: string[];
  callout?: { type: 'info' | 'warn' | 'rule'; text: string };
  schema?: string;
  files?: ResourceLink[];
}

/** Ordre d’une carte « À toi de faire » : texte, cases, commandes et schémas restent intercalés. */
export type DoFlowItem =
  | { type: 'text'; text: string }
  | { type: 'task'; id: string; label: string }
  | { type: 'command'; text: string }
  | { type: 'schema'; text: string }
  | { type: 'callout'; callout: NonNullable<ChapterSection['callout']> };

export interface LayoutCard {
  kind: SectionKind;
  title: string;
  paragraphs: string[];
  bullets: string[];
  commands: string[];
  schema?: string;
  callout?: ChapterSection['callout'];
  files?: ResourceLink[];
  checklist?: CheckItem[];
  flow?: DoFlowItem[];
  hints?: string[];
  quiz?: QuizQuestion[];
  summary?: string;
  learningObjective?: string;
  duration?: string;
  part?: 'A' | 'B';
}

export interface ChapterContent {
  id: string;
  code: string;
  title: string;
  part: 'A' | 'B';
  duration: string;
  summary: string;
  /** Phrase unique affichée sous « À la fin, tu sauras… ». */
  learningObjective: string;
  /** Indices progressifs, repliés par défaut (du plus discret au plus concret). */
  hints: string[];
  objectives: string[];
  sections: ChapterSection[];
  vigilance: string[];
  deliverable: string;
  /** Texte de la carte Ressources (sous Livrables). */
  resources: string;
  resourceFiles: ResourceLink[];
  commands: string[];
  checklist: CheckItem[];
  quiz: QuizQuestion[];
  /**
   * Si présent, l’ordre des cartes est celui du professeur (markdown avec sentinelle).
   * Absent = charte bundlée (Titre → Objectifs → Livrables → Ressources → … → Quiz).
   */
  layout?: LayoutCard[];
}

/** Fiche brute (objectifs / indices peuvent venir de `pedagogy.ts`). */
export type ChapterSeed = Omit<
  ChapterContent,
  'learningObjective' | 'hints' | 'resources' | 'resourceFiles' | 'layout'
> &
  Partial<Pick<ChapterContent, 'learningObjective' | 'hints' | 'resources' | 'resourceFiles'>>;
