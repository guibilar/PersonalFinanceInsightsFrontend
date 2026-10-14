import { Injectable, signal } from '@angular/core';

/**
 * Opens the "Add transaction" panel. The shell shows the panel; Capture and the Transactions page have the buttons
 * that open it, so a transaction can be added from every page with one save path, the same as "Expense" on Android.
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
