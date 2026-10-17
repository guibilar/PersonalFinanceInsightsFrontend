import { Injectable, inject, linkedSignal } from '@angular/core';
import { AuthService } from '../auth/auth.service';

/**
 * Opens the "Import statements" panel. The shell shows the panel; Money and Capture each have a button that opens
 * it, so an import works from every page without each page owning a copy. It outlives the shell: a sign-out or a new
 * sign-in closes the panel, or it would open again for the next person.
 */
@Injectable({ providedIn: 'root' })
export class StatementImportLauncher {
  private readonly shown = linkedSignal({
    source: inject(AuthService).user,
    computation: () => false,
  });
  readonly isOpen = this.shown.asReadonly();

  open(): void {
    this.shown.set(true);
  }

  close(): void {
    this.shown.set(false);
  }
}
