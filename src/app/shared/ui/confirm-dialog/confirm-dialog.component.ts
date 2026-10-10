import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { trapTabKey } from '../focus-trap';
import { ToastService } from '../toast/toast.service';

let nextId = 0;

/**
 * Centred confirmation dialog: the browser's own modal <dialog>, so it opens above a form dialog it was asked
 * from (see ModalComponent for why the browser places it). Render it with @if; Escape or the backdrop cancel.
 * Focus starts on Cancel (the safe choice) and returns to where it was afterwards.
 */
@Component({
  selector: 'app-confirm-dialog',
  host: {
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    <!-- Clicking outside is a mouse shortcut; keyboard users have Escape and Cancel. -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
    <dialog
      #dialog
      class="dialog"
      role="alertdialog"
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="messageId"
      (cancel)="onCancel($event)"
      (click)="onBackdropClick($event)"
    >
      <div class="card-body card p-4">
        <h2 class="h5 mb-2" [id]="titleId">{{ title() }}</h2>
        <p class="text-body-secondary mb-4" [id]="messageId">{{ message() }}</p>
        <div class="d-flex justify-content-end gap-2">
          <button
            #cancelButton
            type="button"
            class="btn btn-outline-secondary"
            (click)="cancelled.emit()"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-danger]="danger()"
            [class.btn-primary]="!danger()"
            (click)="confirmed.emit()"
          >
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </dialog>
  `,
  styles: `
    .dialog {
      width: min(26rem, calc(100% - 2rem));
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--bs-body-color);
    }
    .card {
      box-shadow: var(--bs-box-shadow-lg);
    }
    .dialog::backdrop {
      background: rgb(0 0 0 / 0.45);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent implements OnDestroy {
  private readonly previousFocus = inject(DOCUMENT).activeElement as HTMLElement | null;
  private readonly toasts = inject(ToastService);
  private readonly cancelButton = viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly danger = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  readonly titleId = `confirm-title-${nextId}`;
  readonly messageId = `confirm-message-${nextId++}`;

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.toasts.dialogOpened(this.dialog().nativeElement);
      this.cancelButton().nativeElement.focus();
    });
  }

  /** Escape: the parent removes the dialog, so the browser mustn't close it first. */
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.cancelled.emit();
  }

  // Only a click on the backdrop has the dialog itself as its target: the card fills it edge to edge.
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancelled.emit();
  }

  /** Tab stays on the two buttons while the dialog is open. */
  onKeydown(event: KeyboardEvent): void {
    trapTabKey(event, this.dialog().nativeElement);
  }

  ngOnDestroy(): void {
    this.toasts.dialogClosed(this.dialog().nativeElement);
    this.previousFocus?.focus?.();
  }
}
