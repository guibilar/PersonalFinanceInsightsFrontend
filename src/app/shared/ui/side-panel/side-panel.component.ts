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

let nextId = 0;

/**
 * Dialog that slides in from the right. Render it with @if; it closes on Escape, backdrop click or
 * the close button (emitting `closed`), moves focus into itself and gives it back afterwards.
 */
@Component({
  selector: 'app-side-panel',
  imports: [IconComponent],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="panel-backdrop" (click)="closed.emit()" aria-hidden="true"></div>
    <aside
      #panel
      class="panel"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="titleId"
      tabindex="-1"
    >
      <header class="panel-header">
        <h2 class="h5 mb-0" [id]="titleId">{{ title() }}</h2>
        <button
          type="button"
          class="btn btn-close-panel"
          aria-label="Close"
          (click)="closed.emit()"
        >
          <app-icon name="close" />
        </button>
      </header>
      <div class="panel-body">
        <ng-content />
      </div>
    </aside>
  `,
  styleUrl: './side-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidePanelComponent implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly previousFocus = this.document.activeElement as HTMLElement | null;

  readonly title = input.required<string>();
  readonly closed = output<void>();
  readonly titleId = `side-panel-title-${nextId++}`;

  constructor() {
    afterNextRender(() => {
      // Focus the first field if there is one, else the panel itself.
      const field = this.panel().nativeElement.querySelector<HTMLElement>(
        '.panel-body select, .panel-body input, .panel-body textarea',
      );
      (field ?? this.panel().nativeElement).focus();
    });
  }

  ngOnDestroy(): void {
    this.previousFocus?.focus?.();
  }
}
