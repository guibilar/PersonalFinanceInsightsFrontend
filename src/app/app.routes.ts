import { Routes } from '@angular/router';
import { TransactionListComponent } from './transaction-list/transaction-list.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { BudgetListComponent } from './budget/budget-list.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'transactions', component: TransactionListComponent },
  { path: 'budgets', component: BudgetListComponent }
];
