import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ItemSummaryDto } from '../../../core/models/outputs/home-output-dto';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { warrantyBadge, warrantyOf } from '../home';

/** One item in a list: the name (opens the item), the room or the brand, the value, and the warranty state. */
@Component({
  selector: 'app-item-row',
  imports: [RouterLink, MoneyPipe],
  template: `
    <a class="item-row" [routerLink]="['/home/items', item().id]">
      <span class="flex-grow-1 min-w-0">
        <span class="d-block fw-medium text-break item-name">
          {{ item().name }}
          @if (item().quantity > 1) {
            <span class="text-body-secondary fw-normal">× {{ item().quantity }}</span>
          }
        </span>
        @if (subtitle(); as text) {
          <span class="d-block small text-body-secondary text-truncate">{{ text }}</span>
        }
        @if (warranty(); as w) {
          <span [class]="badge()" data-testid="warranty">
            {{ w.text }}
          </span>
        }
      </span>
      <span class="text-nowrap fw-medium" data-testid="value">{{ item().value | money }}</span>
    </a>
  `,
  styles: `
    .item-row {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
      color: inherit;
      text-decoration: none;
      &:hover .item-name {
        text-decoration: underline;
      }
      &:focus-visible {
        outline: 2px solid var(--bs-primary);
        outline-offset: 2px;
      }
    }
    .min-w-0 {
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemRowComponent {
  readonly item = input.required<ItemSummaryDto>();
  /** Today, `yyyy-MM-dd`. */
  readonly today = input.required<string>();
  /** Show the room in the second line (a search over all rooms), else the category and brand. */
  readonly showRoom = input(false);

  readonly warranty = computed(() => warrantyOf(this.item().warrantyUntil, this.today()));
  readonly badge = computed(() => {
    const warranty = this.warranty();
    return warranty ? `badge rounded-pill fw-normal mt-1 ${warrantyBadge(warranty.state)}` : '';
  });
  readonly subtitle = computed(() => {
    const item = this.item();
    const parts = this.showRoom() ? [item.roomName ?? 'No room'] : [];
    parts.push(...[item.category, item.brand, item.model].filter((part): part is string => !!part));
    return parts.join(' · ');
  });
}
