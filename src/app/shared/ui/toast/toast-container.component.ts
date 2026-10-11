import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from './toast.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-toast-container',
  imports: [IconComponent, RouterLink],
  template: `
    <div #stack class="toast-stack" popover="manual" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          class="app-toast"
          [class.is-error]="toast.kind === 'error'"
          [attr.role]="toast.kind === 'error' ? 'alert' : 'status'"
        >
          <app-icon [name]="toast.kind === 'error' ? 'alert-circle' : 'check-circle'" [size]="18" />
          <span class="flex-grow-1">
            {{ toast.message }}
            @if (toast.link; as link) {
              <a
                class="toast-link"
                [routerLink]="link.route"
                [queryParams]="link.queryParams"
                (click)="toasts.dismiss(toast.id)"
                >{{ link.label }}</a
              >
            }
          </span>
          <button
            type="button"
            class="btn-dismiss"
            aria-label="Dismiss notification"
            (click)="toasts.dismiss(toast.id)"
          >
            <app-icon name="close" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast-stack {
      position: fixed;
      inset: auto 1rem 1rem auto;
      z-index: 1090;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      overflow: visible;
      color: inherit;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: min(22rem, calc(100vw - 2rem));
    }
    .app-toast {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.75rem 0.875rem;
      border: 1px solid var(--bs-border-color);
      border-left: 4px solid var(--bs-success);
      border-radius: var(--bs-border-radius-lg);
      background: var(--bs-body-bg);
      box-shadow: var(--bs-box-shadow);
      color: var(--bs-body-color);
      animation: toast-in 0.2s ease-out;

      app-icon {
        color: var(--bs-success);
      }
      &.is-error {
        border-left-color: var(--bs-danger);
        app-icon:first-child {
          color: var(--bs-danger);
        }
      }
    }
    .toast-link {
      display: inline-block;
      margin-left: 0.25rem;
      font-weight: 600;
    }
    .btn-dismiss {
      display: inline-flex;
      padding: 0.25rem;
      border: 0;
      border-radius: var(--bs-border-radius-sm);
      background: none;
      color: var(--bs-secondary-color);
      &:hover {
        background: var(--bs-secondary-bg);
      }
    }
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(0.5rem);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .app-toast {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainerComponent {
  protected readonly toasts = inject(ToastService);
  private readonly stack = viewChild.required<ElementRef<HTMLElement>>('stack');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // A popover in the top layer, so notifications show above an open dialog (ModalComponent) too. Shown again on
    // every change: the top layer stacks by opening order, and a dialog opened later would cover it.
    effect(() => {
      this.toasts.toasts();
      const stack = this.stack().nativeElement;
      // Inside the open modal dialog, if any (the rest of the page is inert); back here once it closes.
      const parent = this.toasts.topDialog() ?? this.host.nativeElement;
      if (stack.parentElement !== parent) parent.appendChild(stack);
      if (typeof stack.showPopover !== 'function') return;
      if (stack.matches(':popover-open')) stack.hidePopover();
      stack.showPopover();
    });
  }
}
