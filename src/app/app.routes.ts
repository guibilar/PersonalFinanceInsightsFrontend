import { Routes } from '@angular/router';
import { authGuard, signedOutGuard } from './core/auth/auth.guards';
import { LEGACY_FINANCE_REDIRECTS, MONEY_ROOT } from './features/money/money-paths';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [signedOutGuard],
    title: 'Sign in · Personal Finances',
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
        title: 'Today · Personal Finances',
        loadComponent: () =>
          import('./features/today/today.component').then((m) => m.TodayComponent),
      },
      {
        path: 'timeline',
        title: 'Timeline · Personal Finances',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(
            (m) => m.PlaceholderComponent,
          ),
        data: {
          heading: 'Timeline',
          summary: 'What happened, from every module, in order',
          icon: 'history',
          emptyTitle: 'All quiet so far',
          emptyText: 'The timeline fills in as the modules record what happens.',
        },
      },
      {
        path: 'capture',
        title: 'Capture · Personal Finances',
        loadComponent: () =>
          import('./features/capture/capture.component').then((m) => m.CaptureComponent),
      },
      {
        path: 'modules',
        title: 'Modules · Personal Finances',
        loadComponent: () =>
          import('./features/modules/modules.component').then((m) => m.ModulesComponent),
      },
      {
        path: 'search',
        title: 'Search · Personal Finances',
        loadComponent: () =>
          import('./features/placeholder/placeholder.component').then(
            (m) => m.PlaceholderComponent,
          ),
        data: {
          heading: 'Search',
          summary: 'One search across every module',
          icon: 'search',
          emptyTitle: 'Nothing to search yet',
          emptyText: 'Search comes later. Transactions has its own search under Money.',
        },
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
      // The finance pages' old addresses, before Money was a module.
      ...LEGACY_FINANCE_REDIRECTS,
    ],
  },
  { path: '**', redirectTo: '' },
];
