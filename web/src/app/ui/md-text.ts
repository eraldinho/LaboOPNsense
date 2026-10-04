import { Component, input, output } from '@angular/core';
import { isSafeHref, splitInline } from './md-inline';

@Component({
  selector: 'app-md-text',
  template: `
    @for (part of parts(); track $index) {
      @switch (part.type) {
        @case ('image') {
          @if (safe(part.url)) {
            <img [src]="part.url" [alt]="part.alt" loading="lazy" />
          }
        }
        @case ('file') {
          @if (safe(part.url)) {
            <a
              class="md-file"
              [href]="part.url"
              target="_blank"
              rel="noopener noreferrer"
              download
              (click)="notifyLink({ label: 'Télécharger : ' + part.label, url: part.url }, $index)"
            >{{ 'Télécharger : ' + part.label }}</a>
          }
        }
        @case ('link') {
          @if (safe(part.url)) {
            <a
              class="md-link"
              [href]="part.url"
              target="_blank"
              rel="noopener noreferrer"
              (click)="notifyLink({ label: part.label, url: part.url }, $index)"
            >{{ part.label }}</a>
          } @else {
            {{ part.label }}
          }
        }
        @default {
          <span class="md-text">{{ part.text }}</span>
        }
      }
    }
  `,
  styles: `
    :host {
      white-space: pre-line;
    }
  `,
})
export class MdText {
  readonly text = input('');
  /** Rang du premier lien cliquable de ce paragraphe. Null hors section Ressources. */
  readonly linkOrder = input<number | null>(null);
  readonly linkClick = output<{ label: string; url: string; order?: number }>();

  protected parts() {
    return splitInline(this.text());
  }

  protected safe(url: string): boolean {
    return isSafeHref(url);
  }

  protected notifyLink(part: { label: string; url: string }, partIndex: number): void {
    const base = this.linkOrder();
    if (base == null) {
      this.linkClick.emit(part);
      return;
    }
    this.linkClick.emit({ ...part, order: base + this.safeClickableBefore(partIndex) });
  }

  /** Nombre de liens cliquables situés avant cette partie, dans le même paragraphe. */
  private safeClickableBefore(partIndex: number): number {
    const parts = this.parts();
    let count = 0;
    const end = Math.min(partIndex, parts.length);
    for (let index = 0; index < end; index += 1) {
      const part = parts[index];
      if ((part.type === 'link' || part.type === 'file') && isSafeHref(part.url)) count += 1;
    }
    return count;
  }
}
