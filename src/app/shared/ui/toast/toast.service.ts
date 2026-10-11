import { Injectable, computed, signal } from '@angular/core';
import { Params } from '@angular/router';

export type ToastKind = 'success' | 'error';

/** A page that the toast offers to open, for example the item that was just saved. */
export interface ToastLink {
  label: string;
  route: string;
  queryParams?: Params;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  link?: ToastLink;
}

/** Short-lived notifications shown in the corner of the screen by ToastContainerComponent. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  static readonly DURATION_MS = 5000;
  /** A toast with a link stays longer, so there is time to use the link. */
  static readonly LINK_DURATION_MS = 10000;

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

  success(message: string, link?: ToastLink): void {
    this.show('success', message, link);
  }

  /** Errors stay until dismissed, so they can't be missed. */
  error(message: string): void {
    this.show('error', message);
  }

  dismiss(id: number): void {
    this.items.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(kind: ToastKind, message: string, link?: ToastLink): void {
    const toast: Toast = { id: this.nextId++, kind, message, ...(link ? { link } : {}) };
    // Keep at most 4 on screen.
    this.items.update((toasts) => [...toasts, toast].slice(-4));
    if (kind === 'success') {
      const duration = link ? ToastService.LINK_DURATION_MS : ToastService.DURATION_MS;
      setTimeout(() => this.dismiss(toast.id), duration);
    }
  }
}
