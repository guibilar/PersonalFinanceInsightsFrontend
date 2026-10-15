import { Routes } from '@angular/router';
import { MONEY_ROOT } from './money-paths';

/** The Money module: its layout (with the finance sub-menu) and the finance pages. Loaded lazily under `/money`. */
export const MONEY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./money-layout.component').then((m) => m.MoneyLayoutComponent),
    children: [
      {
        path: '',
        title: 'Dashboard · Hestia',
        loadComponent: () =>
          import('../dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'transactions',
        title: 'Transactions · Hestia',
        loadComponent: () =>
          import('../transactions/transaction-list/transaction-list.component').then(
            (m) => m.TransactionListComponent,
          ),
      },
      {
        path: 'budgets',
        title: 'Budgets · Hestia',
        loadComponent: () =>
          import('../budgets/budget-list.component').then((m) => m.BudgetListComponent),
      },
      {
        path: 'subscriptions',
        title: 'Subscriptions · Hestia',
        loadComponent: () =>
          import('../recurring/recurring-list.component').then((m) => m.RecurringListComponent),
      },
      {
        path: 'net-worth',
        title: 'Net worth · Hestia',
        loadComponent: () =>
          import('../net-worth/net-worth.component').then((m) => m.NetWorthComponent),
      },
      {
        path: 'review',
        title: 'Review · Hestia',
        loadComponent: () => import('../review/review.component').then((m) => m.ReviewComponent),
      },
      {
        path: 'rules',
        title: 'Rules · Hestia',
        loadComponent: () =>
          import('../rules/rule-list.component').then((m) => m.RuleListComponent),
      },
      {
        path: 'categories',
        title: 'Categories · Hestia',
        loadComponent: () =>
          import('../categories/category-list.component').then((m) => m.CategoryListComponent),
      },
      {
        path: 'tags',
        title: 'Tags · Hestia',
        loadComponent: () => import('../tags/tag-list.component').then((m) => m.TagListComponent),
      },
      {
        // The bank accounts statements are imported into; features/account is the user's own account.
        path: 'accounts',
        title: 'Accounts · Hestia',
        loadComponent: () =>
          import('../bank-accounts/bank-account-list.component').then(
            (m) => m.BankAccountListComponent,
          ),
      },
      // An unknown page under Money opens the Money home, as an unknown page did before.
      { path: '**', redirectTo: MONEY_ROOT },
    ],
  },
];
