import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';

/**
 * A page of the main menu that has no content yet (Timeline, Search). The route gives its text through `data`, which
 * the router binds to the inputs.
 */
@Component({
  selector: 'app-placeholder',
  imports: [IconComponent],
  template: `
    <div class="mb-4">
      <h1 class="h3 mb-1">{{ heading() }}</h1>
      <p class="text-body-secondary mb-0">{{ summary() }}</p>
    </div>
    <div class="card empty-state">
      <div class="card-body text-center py-5">
        <span class="empty-icon mb-3"><app-icon [name]="icon()" [size]="28" /></span>
        <p class="fw-semibold mb-1">{{ emptyTitle() }}</p>
        <p class="text-body-secondary small mb-0">{{ emptyText() }}</p>
      </div>
    </div>
  `,
  styles: `
    .empty-state {
      border-style: dashed;
      background: transparent;
    }

    .empty-icon {
      display: inline-flex;
      padding: 0.875rem;
      border-radius: 50%;
      background: var(--bs-secondary-bg);
      color: var(--bs-secondary-color);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceholderComponent {
  readonly heading = input.required<string>();
  readonly summary = input.required<string>();
  readonly icon = input.required<IconName>();
  readonly emptyTitle = input.required<string>();
  readonly emptyText = input.required<string>();
}
