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
      {
        path: 'subscriptions',
        title: 'Subscriptions · Personal Finances',
        loadComponent: () =>
          import('./features/recurring/recurring-list.component').then(
            (m) => m.RecurringListComponent,
          ),
      },
      {
        path: 'net-worth',
        title: 'Net worth · Personal Finances',
        loadComponent: () =>
          import('./features/net-worth/net-worth.component').then((m) => m.NetWorthComponent),
      },
      {
        path: 'review',
        title: 'Review · Personal Finances',
        loadComponent: () =>
          import('./features/review/review.component').then((m) => m.ReviewComponent),
      },
      {
        path: 'rules',
        title: 'Rules · Personal Finances',
        loadComponent: () =>
          import('./features/rules/rule-list.component').then((m) => m.RuleListComponent),
      },
      {
        path: 'categories',
        title: 'Categories · Personal Finances',
        loadComponent: () =>
          import('./features/categories/category-list.component').then(
            (m) => m.CategoryListComponent,
          ),
      },
      {
        path: 'tags',
        title: 'Tags · Personal Finances',
        loadComponent: () =>
          import('./features/tags/tag-list.component').then((m) => m.TagListComponent),
      },
      {
        // The bank accounts statements are imported into; features/account is the user's own account.
        path: 'accounts',
        title: 'Accounts · Personal Finances',
        loadComponent: () =>
          import('./features/bank-accounts/bank-account-list.component').then(
            (m) => m.BankAccountListComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
