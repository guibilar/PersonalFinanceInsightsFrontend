import { Injectable, signal } from '@angular/core';

/**
 * Opens the "Add transaction" panel. The shell shows the panel; Capture has the button that opens it, so a
 * transaction can be added from every page, the same as "Expense" on Android.
 */
@Injectable({ providedIn: 'root' })
export class TransactionAddLauncher {
  private readonly shown = signal(false);
  readonly isOpen = this.shown.asReadonly();

  /** The date and account of the last transaction added here, which the next one starts on. */
  readonly lastAdded = signal<{ date: string; accountId: string } | null>(null);

  open(): void {
    this.shown.set(true);
  }

  close(): void {
    this.shown.set(false);
  }
}
