import { Routes } from '@angular/router';
import { authGuard, signedOutGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [signedOutGuard],
    title: 'Sign in · Personal Finances',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    // Everything else needs a signed-in user and lives inside the sidebar layout.
    path: '',
    loadComponent: () =>
      import('./core/layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        title: 'Dashboard · Personal Finances',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'transactions',
        title: 'Transactions · Personal Finances',
        loadComponent: () =>
          import('./features/transactions/transaction-list/transaction-list.component').then(
            (m) => m.TransactionListComponent,
          ),
      },
      {
        path: 'budgets',
        title: 'Budgets · Personal Finances',
        loadComponent: () =>
          import('./features/budgets/budget-list.component').then((m) => m.BudgetListComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
