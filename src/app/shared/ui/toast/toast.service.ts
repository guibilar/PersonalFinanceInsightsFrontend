import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { Params } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

export type ToastKind = 'success' | 'error';

/** A page that the toast offers to open, for example the item that was just saved. */
export interface ToastLink {
  label: string;
  route: string;
  queryParams?: Params;
}

/** A button in the toast, for example "Undo" after a task is marked done. A click runs it and closes the toast. */
export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  link?: ToastLink;
  action?: ToastAction;
}

/**
 * Short-lived notifications shown in the corner of the screen by ToastContainerComponent. A sign-out or a new sign-in
 * clears them: an "Undo" left on the sign-in page would call the API without a session, or for the next person.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  static readonly DURATION_MS = 5000;
  /** A toast with a link stays longer, so there is time to use the link. */
  static readonly LINK_DURATION_MS = 10000;

  private nextId = 1;
  private readonly items = linkedSignal<unknown, Toast[]>({
    source: inject(AuthService).user,
    computation: () => [],
  });
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

  /** A success with a button, for example "Undo". It stays as long as a toast with a link. */
  successWithAction(message: string, action: ToastAction): void {
    this.show('success', message, undefined, action);
  }

  /** Errors stay until dismissed, so they can't be missed. */
  error(message: string): void {
    this.show('error', message);
  }

  dismiss(id: number): void {
    this.items.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(kind: ToastKind, message: string, link?: ToastLink, action?: ToastAction): void {
    const toast: Toast = {
      id: this.nextId++,
      kind,
      message,
      ...(link ? { link } : {}),
      ...(action ? { action } : {}),
    };
    // Keep at most 4 on screen.
    this.items.update((toasts) => [...toasts, toast].slice(-4));
    if (kind === 'success') {
      const duration = link || action ? ToastService.LINK_DURATION_MS : ToastService.DURATION_MS;
      setTimeout(() => this.dismiss(toast.id), duration);
    }
  }
}
