import { Injectable, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TaskRepository } from '../api/task-repository';
import { AuthService } from '../auth/auth.service';
import { DataChangesService } from './data-changes.service';
import { valueOf } from '../../shared/utils/resource-value';
import { isoDay } from '../../shared/utils/date-presets';

/**
 * The counts of open tasks (`GET /api/tasks/summary`): the overdue badge of Tasks in the menu, and the server's
 * "today" for the Tasks page. It loads again after each data change from this app (`DataChangesService`), and on each
 * sign-in: the service outlives the shell, so the counts of the session before would stay otherwise.
 */
@Injectable({ providedIn: 'root' })
export class TaskCountsService {
  private readonly repository = inject(TaskRepository);
  private readonly dataChanges = inject(DataChangesService);
  private readonly auth = inject(AuthService);

  private readonly resource = rxResource({
    // Signed out, there is nothing to ask (the API would answer 401).
    params: () => {
      const user = this.auth.user();
      return user ? { version: this.dataChanges.version(), user } : undefined;
    },
    stream: () => this.repository.summary(),
  });

  /** The counts, or undefined before the first answer or after an error (for example a backend without Tasks). */
  readonly counts = computed(() => valueOf(this.resource));

  /** The overdue count for the badge: 0 when it is not known. */
  readonly overdue = computed(() => this.counts()?.overdue ?? 0);

  /**
   * Today as `yyyy-MM-dd`, in the time zone of the server (it decides what is overdue). The browser's day until the
   * server answers.
   */
  readonly today = computed(() => this.counts()?.date ?? isoDay(new Date()));
}
