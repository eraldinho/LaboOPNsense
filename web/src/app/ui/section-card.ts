import { Component, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { SectionKind } from '../core/content/chapter.types';
import { SectionTypePicker } from './section-type-picker';

@Component({
  selector: 'app-section-card',
  imports: [SectionTypePicker],
  template: `
    <section class="card section-card" [attr.data-kind]="kind()">
      <header class="section-toolbar">
        <div class="title-slot" [hidden]="kind() !== 'title'">
          <ng-content select="[slot=meta]" />
        </div>
        @if (kind() !== 'title') {
          <h2 [class.do-title]="kind() === 'do'">{{ title() }}</h2>
        }
        @if (editable()) {
          <div class="section-tools">
            @if (allowStructure()) {
              <div class="add-wrap">
                <button
                  type="button"
                  class="icon-btn"
                  (click)="togglePicker('above')"
                  [attr.aria-expanded]="picker() === 'above'"
                  aria-label="Ajouter une section au-dessus"
                  title="Ajouter une section au-dessus"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path fill="currentColor" d="M12 5l7 8H5l7-8zm-7 12h14v2H5v-2z" />
                  </svg>
                </button>
                @if (picker() === 'above') {
                  <app-section-type-picker (pick)="choose('above', $event)" />
                }
              </div>
              <div class="add-wrap">
                <button
                  type="button"
                  class="icon-btn"
                  (click)="togglePicker('below')"
                  [attr.aria-expanded]="picker() === 'below'"
                  aria-label="Ajouter une section en dessous"
                  title="Ajouter une section en dessous"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path fill="currentColor" d="M5 5h14v2H5V5zm7 6l7 8H5l7-8z" />
                  </svg>
                </button>
                @if (picker() === 'below') {
                  <app-section-type-picker (pick)="choose('below', $event)" />
                }
              </div>
              <button
                type="button"
                class="icon-btn"
                (click)="moveUp.emit()"
                [disabled]="!canMoveUp()"
                aria-label="Déplacer avant la section précédente"
                title="Avant la section précédente"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path fill="currentColor" d="M7 14l5-6 5 6H7z" />
                </svg>
              </button>
              <button
                type="button"
                class="icon-btn"
                (click)="moveDown.emit()"
                [disabled]="!canMoveDown()"
                aria-label="Déplacer après la section suivante"
                title="Après la section suivante"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path fill="currentColor" d="M7 10l5 6 5-6H7z" />
                </svg>
              </button>
              @if (sendTargets().length) {
                <div class="add-wrap">
                  <button
                    type="button"
                    class="icon-btn"
                    (click)="togglePicker('send')"
                    [attr.aria-expanded]="picker() === 'send'"
                    aria-label="Envoyer vers un autre chapitre"
                    title="Envoyer vers un autre chapitre"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M4 4h9v2H6v12h12v-7h2v9H4V4zm9.6 2.6L16 9l-6 6-1.4-1.4 6-6-2.4-2.4L16 4h6v6l-1.6-2.4-2 2-1.4-1.4 2-2L16.6 4H13.6z"
                      />
                    </svg>
                  </button>
                  @if (picker() === 'send') {
                    <div class="type-picker" role="menu">
                      <p class="picker-label">Envoyer vers</p>
                      @for (target of sendTargets(); track target.id) {
                        <button type="button" role="menuitem" (click)="chooseSend(target.id)">
                          {{ target.label }}
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            }
            <button type="button" class="icon-btn pencil" (click)="edit.emit()" [attr.aria-label]="'Modifier : ' + title()">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.04a1 1 0 0 0 0-1.41l-2.51-2.51a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.99-1.66z"
                />
              </svg>
            </button>
            @if (allowStructure()) {
              <button
                type="button"
                class="icon-btn trash"
                (click)="remove.emit()"
                [attr.aria-label]="'Supprimer : ' + title()"
                title="Supprimer cette section"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M6 7h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7zm3-4h6l1 2h4v2H4V5h4l1-2z"
                  />
                </svg>
              </button>
            }
          </div>
        }
      </header>
      @if (kind() === 'title') {
        <h1>{{ title() }}</h1>
      }
      <ng-content />
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .section-toolbar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.35rem;
    }

    .title-slot {
      flex: 1;
      min-width: 0;
    }

    h2 {
      margin: 0;
      flex: 1;
    }

    h1 {
      margin: 0.15rem 0 0.45rem;
    }

    .do-title {
      font-size: 1.45rem;
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    .section-tools {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      flex-shrink: 0;
    }

    .add-wrap {
      position: relative;
    }

    .icon-btn {
      appearance: none;
      width: 2.1rem;
      height: 2.1rem;
      display: grid;
      place-items: center;
      border-radius: 0.45rem;
      border: 1px solid var(--line);
      background: color-mix(in srgb, var(--bg) 55%, transparent);
      color: var(--accent);
      cursor: pointer;
    }

    .icon-btn:hover,
    .icon-btn:focus-visible {
      border-color: var(--accent);
      outline: none;
    }

    .icon-btn:disabled {
      opacity: 0.35;
      cursor: default;
    }

    .type-picker {
      position: absolute;
      z-index: 20;
      top: calc(100% + 0.3rem);
      right: 0;
      min-width: 12.5rem;
      display: grid;
      gap: 0.15rem;
      padding: 0.45rem;
      border: 1px solid var(--line);
      border-radius: 0.55rem;
      background: var(--bg-raise-2);
      box-shadow: 0 0.6rem 1.4rem #0008;
    }

    .picker-label {
      margin: 0 0.25rem 0.25rem;
      font-size: 0.72rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .type-picker button {
      appearance: none;
      text-align: left;
      border: 0;
      border-radius: 0.35rem;
      background: transparent;
      color: var(--text);
      padding: 0.4rem 0.5rem;
      cursor: pointer;
    }

    .type-picker button:hover,
    .type-picker button:focus-visible {
      background: color-mix(in srgb, var(--accent) 16%, transparent);
      outline: none;
    }

    .trash {
      color: var(--danger);
    }

    .trash:hover,
    .trash:focus-visible {
      border-color: var(--danger);
    }
  `,
})
export class SectionCard {
  readonly kind = input.required<SectionKind>();
  readonly title = input.required<string>();
  readonly editable = input(false);
  readonly allowStructure = input(true);
  readonly canMoveUp = input(false);
  readonly canMoveDown = input(false);
  readonly sendTargets = input<{ id: string; label: string }[]>([]);
  readonly edit = output<void>();
  readonly remove = output<void>();
  readonly addAbove = output<SectionKind>();
  readonly addBelow = output<SectionKind>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  readonly sendTo = output<string>();

  protected readonly picker = signal<'above' | 'below' | 'send' | null>(null);

  private readonly host = inject(ElementRef<HTMLElement>);

  protected togglePicker(side: 'above' | 'below' | 'send'): void {
    this.picker.update((current) => (current === side ? null : side));
  }

  protected choose(side: 'above' | 'below', kind: SectionKind): void {
    this.picker.set(null);
    if (side === 'above') {
      this.addAbove.emit(kind);
    } else {
      this.addBelow.emit(kind);
    }
  }

  protected chooseSend(chapterId: string): void {
    this.picker.set(null);
    this.sendTo.emit(chapterId);
  }

  @HostListener('document:click', ['$event'])
  protected closePicker(event: Event): void {
    if (this.host.nativeElement.contains(event.target as Node)) {
      return;
    }
    this.picker.set(null);
  }
}
