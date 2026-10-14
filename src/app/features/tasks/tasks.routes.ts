import { Routes } from '@angular/router';

/** The Tasks module: the list, a new task, and one task. Loaded lazily under `/tasks`. */
export const TASKS_ROUTES: Routes = [
  {
    // Today links here: the tile (/tasks) and the alert for many overdue tasks (/tasks?due=overdue).
    path: '',
    title: 'Tasks · Personal Finances',
    loadComponent: () => import('./task-list/task-list.component').then((m) => m.TaskListComponent),
  },
  {
    path: 'new',
    title: 'New task · Personal Finances',
    loadComponent: () => import('./task-new/task-new.component').then((m) => m.TaskNewComponent),
  },
  {
    // The alert for one overdue task links here, as /tasks/<id>.
    path: ':id',
    title: 'Task · Personal Finances',
    loadComponent: () =>
      import('./task-detail/task-detail.component').then((m) => m.TaskDetailComponent),
  },
];
