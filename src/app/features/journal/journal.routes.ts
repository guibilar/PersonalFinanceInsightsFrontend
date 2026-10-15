import { Routes } from '@angular/router';

/** The Journal module (T21): one page, with the day in the address (`/journal?day=2026-10-08`). Loaded lazily. */
export const JOURNAL_ROUTES: Routes = [
  {
    path: '',
    title: 'Journal · Hestia',
    loadComponent: () =>
      import('./journal-page/journal-page.component').then((m) => m.JournalPageComponent),
  },
];
