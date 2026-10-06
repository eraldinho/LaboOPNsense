import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { QuizQuestion, SectionKind } from '../../core/content/chapter.types';
import { ContentOverridesService } from '../../core/content/content-overrides.service';
import { buildDisplaySections, DisplaySection, DoViewBlock, groupedDoFlow, sectionToEditText } from '../../core/content/display-sections';
import {
  ACTIVITY_CONTENT_FILE_ACCEPT,
  insertMarkdownFileLink,
  insertMarkdownImage,
  insertMarkdownLink,
  markdownLinkTag,
} from '../../core/loutravo/loutravo.api';
import { LoutravoError } from '../../core/loutravo/loutravo.types';
import { SessionService } from '../../core/session/session.service';
import { chapterClickTargets } from '../../ui/click-order';
import { buildSeeBlocks } from '../../ui/md-inline';
import { MdText } from '../../ui/md-text';
import { SectionCard } from '../../ui/section-card';
import { SectionTypePicker } from '../../ui/section-type-picker';

@Component({
  selector: 'app-chapter-page',
  imports: [NgTemplateOutlet, RouterLink, SectionCard, MdText, SectionTypePicker],
  templateUrl: './chapter-page.html',
  styleUrl: './chapter-page.scss',
})
export class ChapterPage {
  private readonly session = inject(SessionService);
  private readonly overrides = inject(ContentOverridesService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly view = computed(() => this.session.chapter(this.id()));
  /** Chapitre juste après celui-ci dans la liste de l’activité. */
  protected readonly nextChapter = computed(() => {
    const chapters = this.session.chapters();
    const index = chapters.findIndex((chapter) => chapter.id === this.id());
    if (index < 0) {
      return undefined;
    }
    return chapters[index + 1];
  });
  protected readonly content = computed(() => this.view()?.content);
  protected readonly preview = computed(() => this.session.isPreview());
  protected readonly mockPreview = computed(() => this.preview() && this.session.isMock());
  protected readonly dirty = computed(() => this.overrides.isDirty(this.id(), this.content()));
  protected readonly saveNotice = computed(() => this.overrides.saveNotice());
  protected readonly sections = computed(() => {
    const c = this.content();
    return c ? buildDisplaySections(c) : [];
  });
  protected readonly clickTargets = computed(() =>
    chapterClickTargets(this.sections(), this.content()?.commands ?? []),
  );
  protected readonly busy = signal(false);
  protected readonly localError = signal<string | null>(null);
  protected readonly quizTried = signal(false);
  protected readonly editingKey = signal<string | null>(null);
  protected readonly draft = signal('');
  protected readonly imageUrl = signal('');
  protected readonly linkUrl = signal('');
  protected readonly linkText = signal('');
  protected readonly draftArea = viewChild<ElementRef<HTMLTextAreaElement>>('draftArea');
  protected readonly saveBusy = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly emptyPicker = signal(false);
  protected readonly fileAccept = ACTIVITY_CONTENT_FILE_ACCEPT;

  protected readonly checklistDone = computed(() => {
    const c = this.content();
    const id = this.id();
    if (!c) {
      return false;
    }
    const tasks = this.sections().flatMap((sec) =>
      sec.kind === 'do'
        ? groupedDoFlow(sec, c.commands).flatMap((block) => (block.type === 'tasks' ? block.items : []))
        : [],
    );
    if (!tasks.length) {
      return true;
    }
    return tasks.every((item) => this.session.isChecked(id, item.id));
  });

  protected readonly quizQuestions = computed(() => {
    const fromSection = this.sections().find((s) => s.kind === 'quiz');
    if (fromSection) {
      return fromSection.quiz ?? [];
    }
    if (this.content()?.layout) {
      return [];
    }
    return this.content()?.quiz ?? [];
  });

  protected readonly quizPassed = computed(() => {
    if (!this.quizQuestions().length) {
      return true;
    }
    return this.session.quizPassed(this.id());
  });

  protected readonly allAnswered = computed(() => {
    const id = this.id();
    const quiz = this.quizQuestions();
    if (!quiz.length) {
      return true;
    }
    return quiz.every((q) => typeof this.session.answer(id, q.id) === 'number');
  });

  protected readonly correctCount = computed(() => {
    return this.quizQuestions().filter((q) => this.isCorrect(q)).length;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0);
      }
      this.quizTried.set(false);
      this.localError.set(null);
      this.cancelEdit();
      untracked(() => {
        const view = this.session.chapter(id);
        if (!view) {
          void this.router.navigateByUrl('/parcours');
          return;
        }
        if (this.session.isPreview()) {
          return;
        }
      });
    });
    effect(() => {
      const view = this.view();
      if (!view || this.session.isPreview()) {
        return;
      }
      if (view.playable && !untracked(() => this.session.hasStartedLocal(view.id))) {
        void this.safeStarted(view.id);
      }
    });
  }

  protected checked(itemId: string): boolean {
    return this.session.isChecked(this.id(), itemId);
  }

  protected toggle(item: { id: string; label: string }, sectionKey: string): void {
    if (this.preview()) {
      this.session.toggleCheck(this.id(), item.id);
      return;
    }
    if (this.view()?.locked || this.view()?.completed) {
      return;
    }
    const checked = !this.session.isChecked(this.id(), item.id);
    this.session.toggleCheck(this.id(), item.id);
    this.session.reportSignal({
      chapterId: this.id(),
      kind: 'check',
      label: item.label,
      checked,
      order: this.checkOrder(sectionKey, item.id),
    });
  }

  protected onResourceLink(link: { label: string; url: string; order?: number }): void {
    if (this.preview() || this.view()?.locked) return;
    this.session.reportSignal({
      chapterId: this.id(),
      kind: 'link',
      label: link.label,
      href: link.url,
      order: link.order,
    });
  }

  /** Rang du premier lien cliquable de ce paragraphe de ressources. */
  protected linkOrder(sectionKey: string, paragraphIndex: number): number | null {
    const target = this.clickTargets().find(
      (item) => item.sectionKey === sectionKey && item.paragraphIndex === paragraphIndex && item.partIndex === 0,
    );
    return target ? target.order : null;
  }

  protected fileOrder(sectionKey: string, fileIndex: number): number | undefined {
    return this.clickTargets().find((item) => item.sectionKey === sectionKey && item.fileIndex === fileIndex)?.order;
  }

  protected checkOrder(sectionKey: string, checkId: string): number | undefined {
    return this.clickTargets().find((item) => item.sectionKey === sectionKey && item.checkId === checkId)?.order;
  }

  protected selected(questionId: string): number | undefined {
    return this.session.answer(this.id(), questionId);
  }

  protected choose(questionId: string, index: number): void {
    if (this.preview()) {
      this.quizTried.set(false);
      this.session.setAnswer(this.id(), questionId, index);
      return;
    }
    if (this.view()?.locked || this.view()?.completed) {
      return;
    }
    this.quizTried.set(false);
    this.session.setAnswer(this.id(), questionId, index);
  }

  protected isCorrect(q: QuizQuestion): boolean {
    return this.selected(q.id) === q.correctIndex;
  }

  protected submitQuiz(): void {
    const quiz = this.quizQuestions();
    if (!quiz.length || !this.allAnswered()) {
      return;
    }
    const ok = quiz.every((q) => this.isCorrect(q));
    this.quizTried.set(true);
    this.session.setQuizPassed(this.id(), ok);
  }

  protected canComplete(): boolean {
    const view = this.view();
    return !!view && !this.preview() && view.playable && this.checklistDone() && this.quizPassed();
  }

  protected startEdit(section: DisplaySection): void {
    if (!this.preview() || !section.editable) {
      return;
    }
    this.editingKey.set(section.key);
    this.draft.set(sectionToEditText(section));
    this.imageUrl.set('');
    this.linkUrl.set('');
    this.linkText.set('');
    this.saveError.set(null);
  }

  protected cancelEdit(): void {
    this.editingKey.set(null);
    this.draft.set('');
    this.imageUrl.set('');
    this.linkUrl.set('');
    this.linkText.set('');
    this.saveError.set(null);
    this.emptyPicker.set(false);
  }

  protected doBlocks(sec: DisplaySection): DoViewBlock[] {
    return groupedDoFlow(sec, this.content()?.commands ?? []);
  }

  protected seeBlocks(sec: DisplaySection) {
    return buildSeeBlocks(sec.paragraphs, sec.bullets);
  }

  protected editorHint(kind: SectionKind): string {
    switch (kind) {
      case 'title':
        return 'Entrée : nouvelle ligne. Garde la ligne « À la fin, tu sauras… ».';
      case 'objectives':
        return 'Un objectif par ligne. Tu peux commencer par « - ».';
      case 'know':
        return 'Entrée : nouvelle ligne. Puce : « - » et un espace. Garde cette carte courte : un fait utile, pas une consigne.';
      case 'do':
        return 'Entrée : nouvelle ligne. Une ligne qui commence par « - » (tiret + espace) devient une case à cocher. Les autres lignes restent du texte : tu peux les intercaler entre les cases.';
      case 'see':
        return 'Une ligne par constat. Une image insérée seule sur sa ligne s’affiche. Elle ne devient pas une puce.';
      case 'quiz':
        return 'Une question, puis les choix : « * » = bonne réponse, « - » = les autres. L’explication entre parenthèses.';
      default:
        return 'Entrée : nouvelle ligne. Ligne vide : nouveau paragraphe. Puce : commence par un tiret et un espace (exemple : - comme ceci).';
    }
  }

  protected onDraft(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  protected onImageUrl(event: Event): void {
    this.imageUrl.set((event.target as HTMLInputElement).value);
  }

  protected onLinkUrl(event: Event): void {
    this.linkUrl.set((event.target as HTMLInputElement).value);
  }

  protected onLinkText(event: Event): void {
    this.linkText.set((event.target as HTMLInputElement).value);
  }

  protected insertWebLink(): void {
    const url = normalizeHttpUrl(this.linkUrl());
    if (!url) {
      this.saveError.set('Colle une URL http(s).');
      return;
    }
    const area = this.draftArea()?.nativeElement;
    const selected = area
      ? area.value.slice(area.selectionStart ?? 0, area.selectionEnd ?? 0).trim()
      : '';
    const label = this.linkText().trim() || selected;
    const tag = markdownLinkTag(url, label);
    if (area) {
      const start = area.selectionStart ?? this.draft().length;
      const end = area.selectionEnd ?? start;
      this.draft.set(`${this.draft().slice(0, start)}${tag}${this.draft().slice(end)}`);
    } else {
      this.draft.set(insertMarkdownLink(this.draft(), url, label));
    }
    this.linkUrl.set('');
    this.linkText.set('');
    this.saveError.set(null);
  }

  protected insertImageUrl(): void {
    const url = this.imageUrl().trim();
    if (!url) {
      this.saveError.set('Indique une URL d’image.');
      return;
    }
    this.draft.set(insertMarkdownImage(this.draft(), url));
    this.imageUrl.set('');
    this.saveError.set(null);
  }

  protected insertFileUrl(): void {
    const url = this.imageUrl().trim();
    if (!url) {
      this.saveError.set('Indique une URL de fichier.');
      return;
    }
    this.draft.set(insertMarkdownFileLink(this.draft(), url));
    this.imageUrl.set('');
    this.saveError.set(null);
  }

  protected async onImageFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    await this.attachAsset(file, 'image');
  }

  protected async onAttachFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    await this.attachAsset(file, 'file');
  }

  protected async saveChapter(): Promise<void> {
    const c = this.content();
    const s = this.session.session();
    if (!c || !s || !this.preview()) {
      return;
    }
    this.saveBusy.set(true);
    this.saveError.set(null);
    try {
      await this.overrides.saveChapter({
        appId: s.appId,
        sessionToken: s.sessionToken,
        chapterId: this.id(),
        preview: this.preview(),
        base: c,
      });
    } catch (err) {
      this.saveError.set(
        err instanceof LoutravoError ? err.message : err instanceof Error ? err.message : 'Sauvegarde impossible.',
      );
    } finally {
      this.saveBusy.set(false);
    }
  }

  protected async saveEdit(section: DisplaySection): Promise<void> {
    const c = this.content();
    const s = this.session.session();
    const bundled = this.view()?.content;
    if (!c || !s || !bundled) {
      return;
    }
    this.saveBusy.set(true);
    this.saveError.set(null);
    try {
      const base = bundled;
      await this.overrides.saveSection({
        appId: s.appId,
        sessionToken: s.sessionToken,
        chapterId: this.id(),
        base,
        section,
        text: this.draft(),
        preview: this.preview(),
      });
      this.cancelEdit();
    } catch (err) {
      this.saveError.set(err instanceof LoutravoError ? err.message : err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      this.saveBusy.set(false);
    }
  }

  protected async addSection(index: number, kind: SectionKind): Promise<void> {
    await this.mutateLayout((base, s) =>
      this.overrides.insertSection({
        appId: s.appId,
        sessionToken: s.sessionToken,
        chapterId: this.id(),
        base,
        index,
        kind,
        preview: this.preview(),
      }),
    );
    this.emptyPicker.set(false);
  }

  protected async addFirstSection(kind: SectionKind): Promise<void> {
    await this.addSection(0, kind);
  }

  protected sendTargets(): { id: string; label: string }[] {
    return this.session
      .chapters()
      .filter((chapter) => chapter.id !== this.id() && !!chapter.content)
      .map((chapter) => ({
        id: chapter.id,
        label: [chapter.code, chapter.displayTitle].filter(Boolean).join(' · '),
      }));
  }

  protected async moveSection(index: number, delta: number): Promise<void> {
    await this.mutateLayout((base, s) =>
      this.overrides.moveSection({
        appId: s.appId,
        sessionToken: s.sessionToken,
        chapterId: this.id(),
        base,
        index,
        delta,
        preview: this.preview(),
      }),
    );
  }

  protected async sendSection(index: number, targetChapterId: string): Promise<void> {
    const target = this.session.chapter(targetChapterId);
    if (!target?.content) {
      return;
    }
    const label = [target.code, target.displayTitle].filter(Boolean).join(' · ');
    const ok = window.confirm(`Envoyer cette section vers « ${label} » ?`);
    if (!ok) {
      return;
    }
    await this.mutateLayout((base, s) =>
      this.overrides.sendSection({
        appId: s.appId,
        sessionToken: s.sessionToken,
        preview: this.preview(),
        fromChapterId: this.id(),
        toChapterId: targetChapterId,
        fromBase: base,
        toBase: target.content!,
        index,
      }),
    );
    this.cancelEdit();
  }

  protected async deleteSection(index: number, title: string): Promise<void> {
    if (!this.preview()) {
      return;
    }
    const ok = window.confirm(`Supprimer la section « ${title} » ?`);
    if (!ok) {
      return;
    }
    await this.mutateLayout((base, s) =>
      this.overrides.deleteSection({
        appId: s.appId,
        sessionToken: s.sessionToken,
        chapterId: this.id(),
        base,
        index,
        preview: this.preview(),
      }),
    );
    this.cancelEdit();
  }

  protected toggleEmptyPicker(): void {
    this.emptyPicker.update((open) => !open);
  }

  protected async complete(): Promise<void> {
    const view = this.view();
    if (!view || !this.canComplete()) {
      return;
    }
    this.busy.set(true);
    this.localError.set(null);
    try {
      await this.session.report(view.id, 'completed');
      const next = this.session.chapters().find((c) => c.playable && !c.completed);
      if (next) {
        await this.router.navigate(['/chapitre', next.id]);
      } else {
        await this.router.navigateByUrl('/parcours');
      }
    } catch (err) {
      this.localError.set(err instanceof LoutravoError ? err.message : 'Échec du signalement.');
      if (err instanceof LoutravoError && err.needsRelaunch) {
        await this.router.navigateByUrl('/erreur');
      }
    } finally {
      this.busy.set(false);
    }
  }

  private async attachAsset(file: File, kind: 'image' | 'file'): Promise<void> {
    const s = this.session.session();
    if (!s) {
      return;
    }
    this.saveBusy.set(true);
    this.saveError.set(null);
    try {
      const next =
        kind === 'image'
          ? await this.overrides.insertImage({
              sessionToken: s.sessionToken,
              chapterId: this.id(),
              file,
              draft: this.draft(),
              preview: this.preview(),
            })
          : await this.overrides.insertFile({
              sessionToken: s.sessionToken,
              chapterId: this.id(),
              file,
              draft: this.draft(),
              preview: this.preview(),
            });
      this.draft.set(next);
    } catch (err) {
      this.saveError.set(
        err instanceof Error
          ? err.message
          : kind === 'image'
            ? 'Envoi d’image impossible.'
            : 'Envoi de fichier impossible.',
      );
    } finally {
      this.saveBusy.set(false);
    }
  }

  private async mutateLayout(
    run: (
      base: NonNullable<ReturnType<ChapterPage['content']>>,
      session: NonNullable<ReturnType<SessionService['session']>>,
    ) => Promise<unknown>,
  ): Promise<void> {
    const c = this.content();
    const s = this.session.session();
    if (!c || !s || !this.preview()) {
      return;
    }
    this.saveBusy.set(true);
    this.saveError.set(null);
    try {
      await run(c, s);
    } catch (err) {
      this.saveError.set(
        err instanceof LoutravoError ? err.message : err instanceof Error ? err.message : 'Mise à jour impossible.',
      );
    } finally {
      this.saveBusy.set(false);
    }
  }

  private async safeStarted(chapterId: string): Promise<void> {
    try {
      await this.session.report(chapterId, 'started');
      this.session.markStartedLocal(chapterId);
    } catch (err) {
      if (err instanceof LoutravoError && err.httpStatus === 409) {
        this.session.markStartedLocal(chapterId);
        return;
      }
      this.localError.set(err instanceof LoutravoError ? err.message : 'Impossible de démarrer le chapitre.');
      if (err instanceof LoutravoError && err.needsRelaunch) {
        await this.router.navigateByUrl('/erreur');
      }
    }
  }
}

function normalizeHttpUrl(value: string): string {
  let raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }
  if (!/^https?:\/\//i.test(raw) && !/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    raw = `https://${raw}`;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.href;
  } catch {
    return '';
  }
}
