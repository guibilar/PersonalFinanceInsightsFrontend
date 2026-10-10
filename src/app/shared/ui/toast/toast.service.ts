import { Injectable, computed, signal } from '@angular/core';

export type ToastKind = 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

/** Short-lived notifications shown in the corner of the screen by ToastContainerComponent. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  static readonly DURATION_MS = 5000;

  private nextId = 1;
  private readonly items = signal<Toast[]>([]);
  readonly toasts = this.items.asReadonly();

  private readonly dialogs = signal<HTMLDialogElement[]>([]);
  /**
   * The modal dialog on top, if one is open. Everything outside it is inert, a popover shown over it included: the
   * stack goes inside it, so its notifications can be dismissed and are read out.
   */
  readonly topDialog = computed(() => this.dialogs().at(-1) ?? null);

  dialogOpened(dialog: HTMLDialogElement): void {
    this.dialogs.update((dialogs) => [...dialogs, dialog]);
  }

  dialogClosed(dialog: HTMLDialogElement): void {
    this.dialogs.update((dialogs) => dialogs.filter((d) => d !== dialog));
  }

  success(message: string): void {
    this.show('success', message);
  }

  /** Errors stay until dismissed, so they can't be missed. */
  error(message: string): void {
    this.show('error', message);
  }

  dismiss(id: number): void {
    this.items.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(kind: ToastKind, message: string): void {
    const toast: Toast = { id: this.nextId++, kind, message };
    // Keep at most 4 on screen.
    this.items.update((toasts) => [...toasts, toast].slice(-4));
    if (kind === 'success') {
      setTimeout(() => this.dismiss(toast.id), ToastService.DURATION_MS);
    }
  }
}
