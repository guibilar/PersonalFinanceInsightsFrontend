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
import { IconComponent } from '../icon/icon.component';
import { trapTabKey } from '../focus-trap';

let nextId = 0;

/**
 * Centred dialog for a form. Render it with @if; it closes on Escape, a click on the backdrop or the close
 * button (emitting `closed`), moves focus into itself and gives it back afterwards. The page behind it doesn't
 * scroll while it is open.
 */
@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  host: {
    '(document:keydown.escape)': 'closed.emit()',
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    <!-- Clicking outside is a mouse shortcut; keyboard users have Escape and the close button. -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <div
      class="modal-backdrop-layer"
      (mousedown)="pressedOnBackdrop = $event.target === $event.currentTarget"
      (click)="onBackdropClick($event)"
    >
      <div
        #dialog
        class="modal-dialog-box"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        tabindex="-1"
      >
        <header class="modal-header-bar">
          <h2 class="h5 mb-0" [id]="titleId">{{ title() }}</h2>
          <button
            type="button"
            class="btn btn-close-modal"
            aria-label="Close"
            (click)="closed.emit()"
          >
            <app-icon name="close" />
          </button>
        </header>
        <div class="modal-body-area">
          <ng-content />
        </div>
      </div>
    </div>
  `,
  styleUrl: './modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');
  private readonly previousFocus = this.document.activeElement as HTMLElement | null;
  private readonly previousOverflow = this.document.body.style.overflow;

  readonly title = input.required<string>();
  readonly closed = output<void>();
  readonly titleId = `modal-title-${nextId++}`;

  /**
   * Whether the press started on the backdrop: selecting text in a field and letting go outside the dialog
   * ends with a click on the backdrop, and that shouldn't close the form.
   */
  protected pressedOnBackdrop = false;

  constructor() {
    this.document.body.style.overflow = 'hidden';
    afterNextRender(() => {
      const dialog = this.dialog().nativeElement;
      // With a mouse, focus goes straight to the first field. On a touch screen the dialog itself takes it: a
      // field focused from script pops the keyboard up over the form, and Firefox for Android then won't open
      // a dropdown that was focused that way when it is tapped.
      const field = this.touchScreen()
        ? null
        : dialog.querySelector<HTMLElement>(
            '.modal-body-area select, .modal-body-area input, .modal-body-area textarea',
          );
      (field ?? dialog).focus();
    });
  }

  private touchScreen(): boolean {
    return this.document.defaultView?.matchMedia('(pointer: coarse)').matches ?? false;
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && this.pressedOnBackdrop) this.closed.emit();
    this.pressedOnBackdrop = false;
  }

  /** Tab stays inside the dialog while it is open. */
  onKeydown(event: KeyboardEvent): void {
    trapTabKey(event, this.dialog().nativeElement);
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow = this.previousOverflow;
    this.previousFocus?.focus?.();
  }
}
