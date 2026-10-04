import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LoutravoApi } from '../core/loutravo/loutravo.api';
import { LoutravoError } from '../core/loutravo/loutravo.types';
import { SessionService } from '../core/session/session.service';

const LOCAL_SESSION = 'Ouvre l’activité depuis Loutravo pour signaler un bug.';

@Component({
  selector: 'app-bug-report',
  template: `
    <button class="bug-btn" type="button" (click)="show()">Signaler un bug</button>
    @if (sent()) {
      <span class="bug-sent">Envoyé</span>
    }
    @if (open()) {
      <div class="bug-scrim" role="presentation" (click)="close()">
        <div
          class="bug-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bug-title"
          (click)="$event.stopPropagation()"
        >
          <h2 id="bug-title">Signaler un bug</h2>
          <p class="bug-hint">Décris le problème. La page en cours est jointe au signalement.</p>
          <textarea
            #area
            rows="6"
            maxlength="4000"
            aria-label="Problème"
            placeholder="Explique ce qui ne va pas"
            [value]="message()"
            (input)="message.set(asText($event))"
          ></textarea>
          @if (error()) {
            <p class="bug-error">{{ error() }}</p>
          }
          <div class="bug-actions">
            <button class="btn ghost" type="button" (click)="close()">Annuler</button>
            <button class="btn" type="button" [disabled]="busy() || !message().trim()" (click)="send()">
              {{ busy() ? 'Envoi…' : 'Envoyer' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .bug-btn {
      appearance: none;
      border: 1px solid var(--line);
      background: transparent;
      color: var(--text);
      font: inherit;
      font-size: 0.82rem;
      font-weight: 600;
      border-radius: 0.5rem;
      padding: 0.4rem 0.7rem;
      cursor: pointer;
      white-space: nowrap;
    }

    .bug-btn:hover {
      border-color: var(--accent);
    }

    .bug-sent {
      color: var(--muted);
      font-size: 0.78rem;
    }

    .bug-scrim {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: grid;
      place-items: center;
      padding: 1rem;
      background: color-mix(in srgb, black 55%, transparent);
    }

    .bug-dialog {
      width: min(32rem, 100%);
      max-height: min(88dvh, 40rem);
      overflow: auto;
      padding: 1.1rem 1.15rem;
      border-radius: 0.9rem;
      border: 1px solid var(--line);
      background: var(--bg, #16110b);
      box-shadow: 0 18px 50px rgb(0 0 0 / 35%);
    }

    .bug-dialog h2 {
      margin: 0;
      font-size: 1.15rem;
    }

    .bug-hint {
      margin: 0.4rem 0 0.8rem;
      color: var(--muted);
      font-size: 0.88rem;
    }

    textarea {
      width: 100%;
      resize: vertical;
      min-height: 8rem;
      padding: 0.7rem 0.8rem;
      border-radius: 0.55rem;
      border: 1px solid var(--line);
      background: color-mix(in srgb, var(--bg, #16110b) 80%, white);
      color: var(--text);
      font: inherit;
    }

    .bug-error {
      margin: 0.55rem 0 0;
      color: #e07a6a;
      font-size: 0.88rem;
    }

    .bug-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.9rem;
    }
  `,
})
export class BugReportComponent {
  private readonly session = inject(SessionService);
  private readonly api = inject(LoutravoApi);
  private readonly router = inject(Router);
  private readonly area = viewChild<ElementRef<HTMLTextAreaElement>>('area');
  private attempt = 0;
  private sentTimer = 0;

  protected readonly open = signal(false);
  protected readonly message = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly sent = signal(false);

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.close();
  }

  protected show(): void {
    this.message.set('');
    this.error.set('');
    this.busy.set(false);
    this.open.set(true);
    queueMicrotask(() => this.area()?.nativeElement.focus());
  }

  protected close(): void {
    this.attempt += 1;
    this.open.set(false);
    this.busy.set(false);
    this.error.set('');
  }

  protected asText(event: Event): string {
    return (event.target as HTMLTextAreaElement | null)?.value ?? '';
  }

  protected async send(): Promise<void> {
    const text = this.message().trim();
    if (!text || this.busy()) return;
    const current = this.session.session();
    const token = current?.sessionToken ?? '';
    if (!this.session.isReady() || this.session.isMock() || !token.includes('.')) {
      this.error.set(LOCAL_SESSION);
      return;
    }
    const page = this.pageContext();
    const attempt = ++this.attempt;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.reportActivityBug({
        sessionToken: token,
        message: text,
        pageLabel: page.pageLabel,
        pageUrl: page.pageUrl,
        chapterId: page.chapterId || undefined,
      });
      if (attempt !== this.attempt) return;
      this.open.set(false);
      this.message.set('');
      this.markSent();
    } catch (err) {
      if (attempt !== this.attempt) return;
      this.error.set(err instanceof LoutravoError ? err.message : 'Envoi impossible.');
    } finally {
      if (attempt === this.attempt) this.busy.set(false);
    }
  }

  private markSent(): void {
    this.sent.set(true);
    if (typeof window === 'undefined') return;
    window.clearTimeout(this.sentTimer);
    this.sentTimer = window.setTimeout(() => this.sent.set(false), 4000);
  }

  private pageContext(): { pageLabel: string; pageUrl: string; chapterId: string } {
    const path = this.router.url.split('?')[0] ?? '';
    const pageUrl = currentPageUrl();
    const match = /\/chapitre\/([^/?#]+)/.exec(path);
    if (match) {
      const chapterId = decodePart(match[1]);
      const title = this.session.chapter(chapterId)?.title?.trim();
      return {
        pageLabel: title ? `Chapitre — ${title}` : `Chapitre — ${chapterId}`,
        pageUrl,
        chapterId,
      };
    }
    if (path.includes('/parcours')) return { pageLabel: 'Parcours', pageUrl, chapterId: '' };
    if (path.includes('/erreur')) return { pageLabel: 'Erreur', pageUrl, chapterId: '' };
    return { pageLabel: 'Accueil', pageUrl, chapterId: '' };
  }
}

function currentPageUrl(): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.delete('launch');
  url.searchParams.delete('sessionToken');
  return url.toString();
}

function decodePart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
