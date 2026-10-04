import { Component, output } from '@angular/core';
import { SECTION_PICKER, SectionKind } from '../core/content/chapter.types';

@Component({
  selector: 'app-section-type-picker',
  template: `
    <div class="type-picker" role="menu">
      <p class="picker-label">Type de section</p>
      @for (opt of options; track opt.kind) {
        <button type="button" role="menuitem" (click)="pick.emit(opt.kind)">{{ opt.label }}</button>
      }
    </div>
  `,
  styles: `
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

    button {
      appearance: none;
      text-align: left;
      border: 0;
      border-radius: 0.35rem;
      background: transparent;
      color: var(--text);
      padding: 0.4rem 0.5rem;
      cursor: pointer;
    }

    button:hover,
    button:focus-visible {
      background: color-mix(in srgb, var(--accent) 16%, transparent);
      outline: none;
    }
  `,
})
export class SectionTypePicker {
  readonly options = SECTION_PICKER;
  readonly pick = output<SectionKind>();
}
