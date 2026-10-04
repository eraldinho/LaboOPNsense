import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { SessionService } from './core/session/session.service';
import { BugReportComponent } from './ui/bug-report';

@Component({
  imports: [RouterOutlet, RouterLink, BugReportComponent],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly session = inject(SessionService);
}
