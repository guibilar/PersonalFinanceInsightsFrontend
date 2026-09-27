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

let nextId = 0;

/**
 * Centred confirmation dialog. Render it with @if; Escape or the backdrop cancel. Focus starts on
 * Cancel (the safe choice) and returns to where it was afterwards.
 */
@Component({
  selector: 'app-confirm-dialog',
  host: {
    '(document:keydown.escape)': 'cancelled.emit()',
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    <div class="dialog-backdrop" (click)="cancelled.emit()" aria-hidden="true"></div>
    <div
      #dialog
      class="dialog card"
      role="alertdialog"
      aria-modal="true"
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="messageId"
    >
      <div class="card-body p-4">
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
    </div>
  `,
  styles: `
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1060;
      background: rgb(0 0 0 / 0.45);
    }
    .dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      z-index: 1065;
      width: min(26rem, calc(100vw - 2rem));
      transform: translate(-50%, -50%);
      box-shadow: var(--bs-box-shadow-lg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent implements OnDestroy {
  private readonly previousFocus = inject(DOCUMENT).activeElement as HTMLElement | null;
  private readonly cancelButton = viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');
  private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly danger = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  readonly titleId = `confirm-title-${nextId}`;
  readonly messageId = `confirm-message-${nextId++}`;

  constructor() {
    afterNextRender(() => this.cancelButton().nativeElement.focus());
  }

  /** Tab stays on the two buttons while the dialog is open. */
  onKeydown(event: KeyboardEvent): void {
    trapTabKey(event, this.dialog().nativeElement);
  }

  ngOnDestroy(): void {
    this.previousFocus?.focus?.();
  }
}
