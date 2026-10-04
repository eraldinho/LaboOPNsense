import { inject, Injectable, signal } from '@angular/core';
import { applyMarkdownOverride, applySectionEdit, chapterToMarkdown } from '../content/chapter-markdown';
import { ChapterContent, SectionKind } from '../content/chapter.types';
import { buildDisplaySections, DisplaySection } from '../content/display-sections';
import {
  aliasOverrideMarkdown,
  chapterAliasKeys,
  mergeOverrideMaps,
  pickOverrideMarkdown,
  pickWorkingCopy,
} from '../content/override-lookup';
import { chapterFromDisplay, insertSectionAt, moveSectionAt, removeSectionAt } from '../content/section-crud';
import { PART_A_LIVE_MARKDOWN } from '../content/bank/part-a-live';
import {
  insertMarkdownFileLink,
  insertMarkdownImage,
  LoutravoApi,
  PARCOURS_INTRO_CHAPTER_ID,
  readAllLocalOverrides,
  readDirtyChapterIds,
  writeDirtyChapterIds,
  writeLocalOverrides,
} from '../loutravo/loutravo.api';

const DEMO_TOKENS = new Set(['mock-session', 'demo']);

@Injectable({ providedIn: 'root' })
export class ContentOverridesService {
  private readonly api = inject(LoutravoApi);
  readonly overrides = signal<Record<string, string>>({});
  private readonly working = signal<Record<string, ChapterContent>>({});
  private readonly dirty = signal<Record<string, true>>({});
  readonly saveNotice = signal<string | null>(null);

  async load(appId: string, sessionToken: string | undefined): Promise<void> {
    const local = readAllLocalOverrides();
    let remote: Record<string, string> = {};
    const token = sessionToken && !DEMO_TOKENS.has(sessionToken) ? sessionToken : '';
    try {
      remote = await this.api.getActivityContent(appId, token || undefined);
    } catch {
      /* contenu bundlé + local */
    }
    // Repli le plus bas : copie du texte en ligne (Partie A). Le local puis le hub (Firestore) priment.
    const merged = mergeOverrideMaps(PART_A_LIVE_MARKDOWN, local, remote);
    this.overrides.set(merged);
    this.working.set({});
    this.dirty.set(Object.fromEntries(readDirtyChapterIds().map((id) => [id, true as const])));
    this.saveNotice.set(null);
    writeLocalOverrides(appId, merged);
  }

  apply(chapterId: string, base: ChapterContent | undefined): ChapterContent | undefined {
    if (!base) {
      return undefined;
    }
    const live = pickWorkingCopy(this.working(), chapterId, base);
    if (live) {
      return live;
    }
    const markdown = pickOverrideMarkdown(this.overrides(), chapterId, base);
    if (!markdown) {
      return base;
    }
    return applyMarkdownOverride(base, markdown);
  }

  isDirty(chapterId: string, bundled?: ChapterContent): boolean {
    const flags = this.dirty();
    return chapterAliasKeys(chapterId, bundled).some((key) => flags[key]);
  }

  hasDirty(): boolean {
    return Object.keys(this.dirty()).length > 0;
  }

  introMarkdown(bundled: string): string {
    const override = this.overrides()[PARCOURS_INTRO_CHAPTER_ID];
    return override !== undefined ? override : bundled;
  }

  isIntroDirty(): boolean {
    return !!this.dirty()[PARCOURS_INTRO_CHAPTER_ID];
  }

  setIntro(appId: string, markdown: string): void {
    this.overrides.update((current) => ({ ...current, [PARCOURS_INTRO_CHAPTER_ID]: markdown }));
    writeLocalOverrides(appId, this.overrides());
    this.markDirty(PARCOURS_INTRO_CHAPTER_ID);
    this.saveNotice.set('Modification appliquée. Clique sur Sauvegarder pour la garder.');
  }

  async saveIntro(opts: {
    appId: string;
    sessionToken: string;
    preview: boolean;
    bundled: string;
  }): Promise<void> {
    const markdown = this.introMarkdown(opts.bundled);
    const token = opts.sessionToken && !DEMO_TOKENS.has(opts.sessionToken) ? opts.sessionToken : '';
    if (!this.isIntroDirty() && this.overrides()[PARCOURS_INTRO_CHAPTER_ID] === undefined) {
      this.saveNotice.set('L’introduction est encore le texte d’origine. Modifie-la, puis clique sur Sauvegarder.');
      return;
    }
    writeLocalOverrides(opts.appId, this.overrides());
    if (token && opts.preview) {
      await this.api.saveActivityContent(token, PARCOURS_INTRO_CHAPTER_ID, markdown);
      this.saveNotice.set('Introduction sauvegardée.');
    } else {
      this.saveNotice.set(
        'Introduction sauvegardée dans ce navigateur. Pour tout le monde, ouvre l’aperçu depuis Loutravo.',
      );
    }
    this.clearDirty(PARCOURS_INTRO_CHAPTER_ID);
  }

  async saveSection(opts: {
    appId: string;
    sessionToken: string;
    chapterId: string;
    base: ChapterContent;
    section: DisplaySection;
    text: string;
    preview: boolean;
  }): Promise<ChapterContent> {
    const next = applySectionEdit(opts.base, opts.section, opts.text);
    return this.persist(opts, next);
  }

  async saveDisplay(opts: {
    appId: string;
    sessionToken: string;
    chapterId: string;
    base: ChapterContent;
    sections: DisplaySection[];
    preview: boolean;
  }): Promise<ChapterContent> {
    const next = chapterFromDisplay(opts.base, opts.sections);
    return this.persist(opts, next);
  }

  async insertSection(opts: {
    appId: string;
    sessionToken: string;
    chapterId: string;
    base: ChapterContent;
    index: number;
    kind: SectionKind;
    preview: boolean;
  }): Promise<ChapterContent> {
    const sections = insertSectionAt(buildDisplaySections(opts.base), opts.index, opts.kind, opts.base.title);
    return this.saveDisplay({ ...opts, sections });
  }

  async deleteSection(opts: {
    appId: string;
    sessionToken: string;
    chapterId: string;
    base: ChapterContent;
    index: number;
    preview: boolean;
  }): Promise<ChapterContent> {
    const sections = removeSectionAt(buildDisplaySections(opts.base), opts.index);
    return this.saveDisplay({ ...opts, sections });
  }

  async moveSection(opts: {
    appId: string;
    sessionToken: string;
    chapterId: string;
    base: ChapterContent;
    index: number;
    delta: number;
    preview: boolean;
  }): Promise<ChapterContent> {
    const sections = moveSectionAt(buildDisplaySections(opts.base), opts.index, opts.delta);
    return this.saveDisplay({ ...opts, sections });
  }

  async sendSection(opts: {
    appId: string;
    sessionToken: string;
    preview: boolean;
    fromChapterId: string;
    toChapterId: string;
    fromBase: ChapterContent;
    toBase: ChapterContent;
    index: number;
  }): Promise<void> {
    const fromSections = buildDisplaySections(opts.fromBase);
    const section = fromSections[opts.index];
    if (!section) {
      return;
    }
    const remaining = removeSectionAt(fromSections, opts.index);
    const target = [...buildDisplaySections(opts.toBase), section];
    await this.saveDisplay({
      appId: opts.appId,
      sessionToken: opts.sessionToken,
      preview: opts.preview,
      chapterId: opts.fromChapterId,
      base: opts.fromBase,
      sections: remaining,
    });
    await this.saveDisplay({
      appId: opts.appId,
      sessionToken: opts.sessionToken,
      preview: opts.preview,
      chapterId: opts.toChapterId,
      base: opts.toBase,
      sections: target,
    });
    this.saveNotice.set('Section envoyée. Sauvegarde chaque chapitre modifié pour garder le changement.');
  }

  async insertImage(opts: {
    sessionToken: string;
    chapterId: string;
    file: File;
    draft: string;
    preview: boolean;
  }): Promise<string> {
    const token = opts.sessionToken && !DEMO_TOKENS.has(opts.sessionToken) ? opts.sessionToken : '';
    if (!token || !opts.preview) {
      const localUrl = URL.createObjectURL(opts.file);
      return insertMarkdownImage(opts.draft, localUrl, opts.file.name.replace(/\.[^.]+$/, '') || 'image');
    }
    const uploaded = await this.api.uploadActivityContentImage(token, opts.chapterId, opts.file);
    return insertMarkdownImage(opts.draft, uploaded.url, opts.file.name.replace(/\.[^.]+$/, '') || 'image');
  }

  async insertFile(opts: {
    sessionToken: string;
    chapterId: string;
    file: File;
    draft: string;
    preview: boolean;
  }): Promise<string> {
    const token = opts.sessionToken && !DEMO_TOKENS.has(opts.sessionToken) ? opts.sessionToken : '';
    const label = opts.file.name || 'fichier';
    if (!token || !opts.preview) {
      const localUrl = URL.createObjectURL(opts.file);
      return insertMarkdownFileLink(opts.draft, localUrl, label);
    }
    const uploaded = await this.api.uploadActivityContentFile(token, opts.chapterId, opts.file);
    if (uploaded.markdown) {
      const glue = opts.draft.endsWith('\n') || !opts.draft ? '' : '\n';
      return `${opts.draft}${glue}${uploaded.markdown}${uploaded.markdown.endsWith('\n') ? '' : '\n'}`;
    }
    return insertMarkdownFileLink(opts.draft, uploaded.url, label);
  }

  async saveChapter(opts: {
    appId: string;
    sessionToken: string;
    chapterId: string;
    preview: boolean;
    base?: ChapterContent;
  }): Promise<void> {
    const live = pickWorkingCopy(this.working(), opts.chapterId, opts.base) ?? opts.base;
    if (!live) {
      this.saveNotice.set('Pas de chapitre à sauvegarder.');
      return;
    }
    const dirty = this.isDirty(opts.chapterId, live);
    const hasOverride = !!pickOverrideMarkdown(this.overrides(), opts.chapterId, live);
    if (!dirty && !hasOverride) {
      this.saveNotice.set('Ce chapitre est encore le texte d’origine. Modifie-le, puis clique sur Sauvegarder.');
      return;
    }
    const markdown = chapterToMarkdown(live);
    const token = opts.sessionToken && !DEMO_TOKENS.has(opts.sessionToken) ? opts.sessionToken : '';
    this.putWorking(opts.chapterId, live);
    const map = mergeOverrideMaps(this.overrides(), aliasOverrideMarkdown(opts.chapterId, live, markdown));
    this.overrides.set(map);
    writeLocalOverrides(opts.appId, map);
    if (token && opts.preview) {
      await this.api.saveActivityContent(token, opts.chapterId, markdown);
      this.saveNotice.set('Chapitre sauvegardé.');
    } else {
      this.saveNotice.set('Chapitre sauvegardé dans ce navigateur. Pour tout le monde, ouvre l’aperçu depuis Loutravo.');
    }
    this.clearDirty(opts.chapterId, live);
  }

  private async persist(
    opts: { appId: string; sessionToken: string; chapterId: string; preview: boolean },
    next: ChapterContent,
  ): Promise<ChapterContent> {
    const markdown = chapterToMarkdown(next);
    this.putWorking(opts.chapterId, next);
    const map = mergeOverrideMaps(this.overrides(), aliasOverrideMarkdown(opts.chapterId, next, markdown));
    this.overrides.set(map);
    writeLocalOverrides(opts.appId, map);
    this.markDirty(opts.chapterId, next);
    this.saveNotice.set('Modification appliquée. Clique sur Sauvegarder pour la garder.');
    return next;
  }

  private putWorking(chapterId: string, content: ChapterContent): void {
    this.working.update((current) => {
      const next = { ...current };
      for (const key of chapterAliasKeys(chapterId, content)) {
        next[key] = content;
      }
      return next;
    });
  }

  private markDirty(chapterId: string, bundled?: ChapterContent): void {
    this.dirty.update((current) => {
      const next = { ...current };
      for (const key of chapterAliasKeys(chapterId, bundled)) {
        next[key] = true;
      }
      return next;
    });
    writeDirtyChapterIds(Object.keys(this.dirty()));
  }

  private clearDirty(chapterId: string, bundled?: ChapterContent): void {
    this.dirty.update((current) => {
      const next = { ...current };
      for (const key of chapterAliasKeys(chapterId, bundled)) {
        delete next[key];
      }
      return next;
    });
    writeDirtyChapterIds(Object.keys(this.dirty()));
  }
}
