import { Routes } from '@angular/router';
import { authGuard, signedOutGuard } from './core/auth/auth.guards';
import { LEGACY_FINANCE_REDIRECTS, MONEY_ROOT } from './features/money/money-paths';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [signedOutGuard],
    title: 'Sign in · Hestia',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    // Everything else needs a signed-in user and lives inside the shell (main menu and modules).
    path: '',
    loadComponent: () =>
      import('./core/layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'today' },
      {
        path: 'today',
        title: 'Today · Hestia',
        loadComponent: () =>
          import('./features/today/today.component').then((m) => m.TodayComponent),
      },
      {
        // The Timeline (Hestia.Api, T16): what happened in all modules, day by day.
        path: 'timeline',
        title: 'Timeline · Hestia',
        loadComponent: () =>
          import('./features/timeline/timeline-page/timeline-page.component').then(
            (m) => m.TimelinePageComponent,
          ),
      },
      {
        path: 'capture',
        title: 'Capture · Hestia',
        loadComponent: () =>
          import('./features/capture/capture.component').then((m) => m.CaptureComponent),
      },
      {
        path: 'modules',
        title: 'Modules · Hestia',
        loadComponent: () =>
          import('./features/modules/modules.component').then((m) => m.ModulesComponent),
      },
      {
        // Search (Hestia.Api, T17): one search across all modules.
        path: 'search',
        title: 'Search · Hestia',
        loadComponent: () =>
          import('./features/search/search-page.component').then((m) => m.SearchPageComponent),
      },
      {
        // The Money module: the finance pages, with their sub-menu.
        path: MONEY_ROOT.slice(1),
        loadChildren: () => import('./features/money/money.routes').then((m) => m.MONEY_ROUTES),
      },
      {
        // The Documents module (Hestia.Api): the list, the upload and one document.
        path: 'documents',
        loadChildren: () =>
          import('./features/documents/documents.routes').then((m) => m.DOCUMENTS_ROUTES),
      },
      {
        // The Tasks module (Hestia.Api): the list, a new task and one task.
        path: 'tasks',
        loadChildren: () => import('./features/tasks/tasks.routes').then((m) => m.TASKS_ROUTES),
      },
      {
        // The Home module (Hestia.Api): the Home page, a room, a new item and one item.
        path: 'home',
        loadChildren: () => import('./features/home/home.routes').then((m) => m.HOME_ROUTES),
      },
      {
        // The People module (Hestia.Api): the People page, a new person and one person.
        path: 'people',
        loadChildren: () => import('./features/people/people.routes').then((m) => m.PEOPLE_ROUTES),
      },
      {
        // The Inbox module (Hestia.Api, T18): quick notes to sort later.
        path: 'inbox',
        loadChildren: () => import('./features/inbox/inbox.routes').then((m) => m.INBOX_ROUTES),
      },
      {
        // The Journal module (Hestia.Api, T21): one page, with the day in the address.
        path: 'journal',
        loadChildren: () =>
          import('./features/journal/journal.routes').then((m) => m.JOURNAL_ROUTES),
      },
      {
        // The Calendar module (Hestia.Api, T103, T104): events, and the dates of all modules.
        path: 'calendar',
        loadChildren: () =>
          import('./features/calendar/calendar.routes').then((m) => m.CALENDAR_ROUTES),
      },
      // The finance pages' old addresses, before Money was a module.
      ...LEGACY_FINANCE_REDIRECTS,
    ],
  },
  { path: '**', redirectTo: '' },
];
