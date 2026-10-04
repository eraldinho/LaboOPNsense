import { Routes } from '@angular/router';
import { sessionGuard } from './core/session/session.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/boot/boot-page').then((m) => m.BootPage),
  },
  {
    path: 'parcours',
    loadComponent: () => import('./pages/parcours/parcours-page').then((m) => m.ParcoursPage),
    canActivate: [sessionGuard],
  },
  {
    path: 'chapitre/:id',
    loadComponent: () => import('./pages/chapter/chapter-page').then((m) => m.ChapterPage),
    canActivate: [sessionGuard],
  },
  {
    path: 'erreur',
    loadComponent: () => import('./pages/error/error-page').then((m) => m.ErrorPage),
  },
  { path: '**', redirectTo: '' },
];
