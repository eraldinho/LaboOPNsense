import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../core/session/session.service';

@Component({
  selector: 'app-boot-page',
  template: `
    <section class="card boot">
      <p class="muted">Ouverture de la séance…</p>
      @if (failed()) {
        <p>Relance cette activité depuis Loutravo.</p>
      }
    </section>
  `,
  styles: `
    .boot {
      margin-top: 3rem;
      text-align: center;
    }
  `,
})
export class BootPage implements OnInit {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly failed = signal(false);

  async ngOnInit(): Promise<void> {
    const result = await this.session.boot();
    if (result === 'ok') {
      await this.router.navigateByUrl('/parcours');
      return;
    }
    this.failed.set(true);
    await this.router.navigateByUrl('/erreur');
  }
}
