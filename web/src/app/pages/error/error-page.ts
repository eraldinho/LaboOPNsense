import { Component, inject } from '@angular/core';
import { SessionService } from '../../core/session/session.service';

@Component({
  selector: 'app-error-page',
  template: `
    <section class="card err">
      <p class="pill warn">Séance impossible</p>
      <h1>Relance cette activité depuis Loutravo</h1>
      <p>
        {{ session.errorMessage() || 'Le code de lancement est absent, déjà utilisé ou expiré (5 minutes).' }}
      </p>
      <p class="muted">
        Dans Loutravo, ouvre l’activité <strong>Labo OPNsense</strong> puis clique sur
        <strong>Démarrer</strong>. Ici tu n’écris ni nom, ni e-mail, ni code à la main.
      </p>
    </section>
  `,
  styles: `
    .err {
      margin-top: 2rem;
      max-width: 36rem;
    }
    h1 {
      margin-top: 0.8rem;
    }
  `,
})
export class ErrorPage {
  protected readonly session = inject(SessionService);
}
