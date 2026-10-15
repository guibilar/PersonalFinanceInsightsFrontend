import { Routes } from '@angular/router';

/** The Inbox module (T18): one page. Loaded lazily under `/inbox`. */
export const INBOX_ROUTES: Routes = [
  {
    path: '',
    title: 'Inbox · Personal Finances',
    loadComponent: () =>
      import('./inbox-page/inbox-page.component').then((m) => m.InboxPageComponent),
  },
];
