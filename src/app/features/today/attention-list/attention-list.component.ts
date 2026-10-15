import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router, RouterLink, UrlTree } from '@angular/router';
import { TodayCard } from '../../../core/models/outputs/today-output-dto';
import { IconComponent, IconName } from '../../../shared/ui/icon/icon.component';
import { fillTodayText } from '../today-text';

/**
 * One "Needs attention" item: a Today attention card or an alert from `GET /api/alerts` (both have these fields).
 */
export type AttentionListItem = Pick<
  TodayCard,
  'id' | 'kind' | 'severity' | 'text' | 'values' | 'link'
>;

/** Icons by item kind. A kind not in the list gets a general icon. */
const ICONS: Record<string, IconName> = {
  'budget-over': 'budgets',
  'statements-not-imported': 'upload',
  'statements-behind': 'upload',
  'price-changed': 'refresh',
  unsorted: 'tag',
  // Documents (T11) and Tasks (T19).
  expiring: 'file-text',
  expired: 'file-text',
  overdue: 'list-checks',
  'overdue-many': 'list-checks',
  // Home (T22) and People (T20).
  'warranty-ending': 'house',
  'reach-out': 'users',
  birthday: 'calendar',
  'loan-overdue': 'user',
  // System (T80): a stuck event outbox, the event broker down, document files missing.
  'outbox-stuck': 'history',
  'broker-down': 'devices',
  'files-missing': 'file-text',
};

/**
 * The "Needs attention" card of Today and of the Money dashboard: the items in the given order, each with its text
 * filled in (app formats, privacy mode) and its link. Content inside the element shows above the list, for example a
 * note on a partial check.
 */
@Component({
  selector: 'app-attention-list',
  imports: [RouterLink, IconComponent],
  template: `
    <section class="card attention" [attr.aria-labelledby]="headingId()">
      <div class="card-body py-3">
        <h2 [id]="headingId()" class="h6 mb-2">Needs attention</h2>
        <ng-content />
        @if (items().length > 0) {
          <ul class="list-unstyled mb-0 d-flex flex-column gap-2">
            @for (item of items(); track item.id) {
              <li class="d-flex align-items-center gap-2" [attr.data-card]="item.id">
                <span class="attention-icon" [attr.data-severity]="item.severity">
                  <app-icon [name]="icon(item)" [size]="14" />
                </span>
                @let target = linkOf(item);
                @if (target) {
                  <a [routerLink]="target" class="attention-link flex-grow-1">{{ text(item) }}</a>
                  <app-icon name="arrow-right" [size]="14" class="text-body-secondary" />
                } @else {
                  <span class="flex-grow-1">{{ text(item) }}</span>
                }
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
  styles: `
    .attention {
      border-color: var(--bs-warning-border-subtle);
      background: var(--bs-warning-bg-subtle);
    }

    .attention-icon {
      display: inline-flex;
      flex-shrink: 0;
      padding: 0.3rem;
      border-radius: 50%;
      background: var(--bs-body-bg);
      color: var(--bs-warning-text-emphasis);

      &[data-severity='Bad'] {
        color: var(--bs-danger-text-emphasis);
      }
    }

    .attention-link {
      color: var(--bs-emphasis-color);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttentionListComponent {
  private readonly router = inject(Router);

  readonly items = input.required<readonly AttentionListItem[]>();
  /** The id of the heading, unique on the page. */
  readonly headingId = input('attention-title');

  /** The sentence, with its values filled in. */
  text(item: AttentionListItem): string {
    return fillTodayText(item.text, item.values);
  }

  icon(item: AttentionListItem): IconName {
    return ICONS[item.kind] ?? 'alert-circle';
  }

  /**
   * The item link as a route of this app, with its query string and fragment (for example
   * `/money/transactions#import`). Only a path in this app becomes a link; anything else gives none.
   */
  linkOf(item: AttentionListItem): UrlTree | null {
    const link = item.link;
    if (!link || !link.startsWith('/') || link.startsWith('//')) return null;
    return this.router.parseUrl(link);
  }
}
