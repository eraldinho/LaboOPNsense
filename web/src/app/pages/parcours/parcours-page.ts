import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChapterGroup, groupByMilestones } from '../../core/content/bank/groups';
import { PARCOURS_INTRO_DEFAULT } from '../../core/content/bank/parcours-intro';
import { chapterToMarkdown } from '../../core/content/chapter-markdown';
import { ContentOverridesService } from '../../core/content/content-overrides.service';
import { LoutravoApi } from '../../core/loutravo/loutravo.api';
import { LoutravoError } from '../../core/loutravo/loutravo.types';
import { ChapterView, SessionService } from '../../core/session/session.service';
import { MdText } from '../../ui/md-text';
import { SectionCard } from '../../ui/section-card';

@Component({
  selector: 'app-parcours-page',
  imports: [RouterLink, SectionCard, MdText],
  templateUrl: './parcours-page.html',
  styleUrl: './parcours-page.scss',
})
export class ParcoursPage {
  private readonly session = inject(SessionService);
  private readonly overrides = inject(ContentOverridesService);
  private readonly api = inject(LoutravoApi);

  protected readonly chapters = computed(() => this.session.chapters());
  protected readonly dirty = computed(() => this.overrides.hasDirty());
  protected readonly saveNotice = computed(() => this.overrides.saveNotice());
  protected readonly saveBusy = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly exportBusy = signal<'subject' | 'results' | null>(null);
  protected readonly exportMessage = signal('');
  protected readonly exportError = signal('');
  protected readonly withKey = signal(true);
  protected readonly preview = computed(() => this.session.isPreview());
  protected readonly intro = computed(() => this.overrides.introMarkdown(PARCOURS_INTRO_DEFAULT));
  protected readonly editingIntro = signal(false);
  protected readonly introDraft = signal('');
  protected readonly groups = computed(() => groupByMilestones(this.chapters()));

  protected groupDone(g: ChapterGroup<ChapterView>): boolean {
    return g.items.every((c) => c.completed);
  }

  protected statusLabel(ch: ChapterView): string {
    if (this.preview()) {
      return 'ouvert';
    }
    if (ch.completed) {
      return 'terminé';
    }
    if (ch.playable) {
      return 'en cours';
    }
    if (ch.testLocked) {
      return 'test fermé';
    }
    return 'verrouillé';
  }

  protected startEditIntro(): void {
    if (!this.preview()) {
      return;
    }
    this.introDraft.set(this.intro());
    this.editingIntro.set(true);
    this.saveError.set(null);
  }

  protected onIntroDraft(event: Event): void {
    this.introDraft.set((event.target as HTMLTextAreaElement).value);
  }

  protected applyIntro(): void {
    const s = this.session.session();
    if (!s || !this.preview()) {
      return;
    }
    this.overrides.setIntro(s.appId, this.introDraft());
    this.editingIntro.set(false);
  }

  protected cancelIntro(): void {
    this.editingIntro.set(false);
    this.introDraft.set('');
  }

  protected async saveAll(): Promise<void> {
    const s = this.session.session();
    if (!s || !this.preview()) {
      return;
    }
    this.saveBusy.set(true);
    this.saveError.set(null);
    try {
      if (this.overrides.isIntroDirty()) {
        await this.overrides.saveIntro({
          appId: s.appId,
          sessionToken: s.sessionToken,
          preview: true,
          bundled: PARCOURS_INTRO_DEFAULT,
        });
      }
      for (const ch of this.chapters()) {
        if (!this.overrides.isDirty(ch.id, ch.content)) {
          continue;
        }
        await this.overrides.saveChapter({
          appId: s.appId,
          sessionToken: s.sessionToken,
          chapterId: ch.id,
          preview: true,
          base: ch.content,
        });
      }
    } catch (err) {
      this.saveError.set(
        err instanceof LoutravoError ? err.message : err instanceof Error ? err.message : 'Sauvegarde impossible.',
      );
    } finally {
      this.saveBusy.set(false);
    }
  }

  protected setWithKey(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) this.withKey.set(target.checked);
  }

  protected exportSubject(): Promise<void> {
    return this.exportPdf('subject');
  }

  protected exportResults(): Promise<void> {
    return this.exportPdf('results');
  }

  private async exportPdf(kind: 'subject' | 'results'): Promise<void> {
    const s = this.session.session();
    this.exportMessage.set('');
    this.exportError.set('');
    if (!s || this.session.isMock()) {
      this.exportError.set('Relance l’activité depuis Loutravo pour générer le PDF.');
      return;
    }
    this.exportBusy.set(kind);
    try {
      const chapters = this.chapters()
        .filter((chapter) => !chapter.testLocked)
        .map((chapter) => ({
          id: chapter.id,
          title: chapter.displayTitle,
          code: chapter.code,
          markdown: chapter.content ? chapterToMarkdown(chapter.content) : '',
        }));
      const file = await this.api.exportActivityPdf({
        kind,
        sessionToken: s.sessionToken,
        mode: this.preview() && this.withKey() ? 'prof' : 'eleve',
        includeImages: true,
        introMarkdown: kind === 'subject' ? this.intro() : '',
        chapters: kind === 'subject' ? chapters : [],
      });
      savePdf(file.blob, file.fileName);
      this.exportMessage.set(
        kind === 'subject'
          ? 'Enregistre le PDF pour l’atelier hors-ligne.'
          : 'Enregistre ce PDF : il contient tes réponses enregistrées et tes indicateurs.',
      );
    } catch (err) {
      this.exportError.set(err instanceof LoutravoError ? err.message : 'La génération du PDF a échoué. Réessaie.');
    } finally {
      this.exportBusy.set(null);
    }
  }
}

function savePdf(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
