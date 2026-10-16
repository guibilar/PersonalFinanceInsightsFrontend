import { Injectable, signal } from '@angular/core';

/** Values for a new transaction, from a receipt (T100). After the add, the shell links the document to it. */
export interface TransactionPrefill {
  description: string;
  /** Money out, as a positive amount. */
  amount: number | null;
  /** `yyyy-MM-dd`. */
  date: string | null;
  /** The receipt to link to the new transaction. */
  documentId?: string;
}

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

  /** The values of the next form, from a receipt (T100); null for an empty form. */
  readonly prefill = signal<TransactionPrefill | null>(null);

  open(prefill: TransactionPrefill | null = null): void {
    this.prefill.set(prefill);
    this.shown.set(true);
  }

  close(): void {
    this.shown.set(false);
    this.prefill.set(null);
  }
}
