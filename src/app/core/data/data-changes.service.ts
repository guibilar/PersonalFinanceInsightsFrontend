import { Injectable, signal } from '@angular/core';

/**
 * Says when transactions changed from outside the page showing them (a statement imported from the sidebar), so the
 * page can load them again.
 */
@Injectable({ providedIn: 'root' })
export class DataChangesService {
  private readonly count = signal(0);
  /** Goes up on each change; read it in a resource's params or an effect to reload. */
  readonly version = this.count.asReadonly();

  changed(): void {
    this.count.update((n) => n + 1);
  }
}
