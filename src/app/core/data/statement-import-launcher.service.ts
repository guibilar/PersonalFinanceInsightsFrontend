import { Injectable, signal } from '@angular/core';

/**
 * Opens the "Import statements" panel. The shell shows the panel; Money and Capture each have a button that opens
 * it, so an import works from every page without each page owning a copy.
 */
@Injectable({ providedIn: 'root' })
export class StatementImportLauncher {
  private readonly shown = signal(false);
  readonly isOpen = this.shown.asReadonly();

  open(): void {
    this.shown.set(true);
  }

  close(): void {
    this.shown.set(false);
  }
}
