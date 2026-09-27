import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'transactions',
    loadComponent: () =>
      import('./features/transactions/transaction-list/transaction-list.component').then(
        (m) => m.TransactionListComponent,
      ),
  },
  {
    path: 'budgets',
    loadComponent: () =>
      import('./features/budgets/budget-list.component').then((m) => m.BudgetListComponent),
  },
  { path: '**', redirectTo: '' },
];
