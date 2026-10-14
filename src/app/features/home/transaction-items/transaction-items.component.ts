import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth.service';
import { HomeRepository } from '../../../core/api/home-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { ITEM_TRANSACTION_LINK } from '../../../core/models/outputs/home-output-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { keptValueOf } from '../../../shared/utils/resource-value';
import { HOME_LIMITS } from '../home';

/**
 * The "Home inventory" section of one transaction (Money): the items that link to it
 * (`GET /api/home/items/by-link?kind=Money.Transaction`), each opening its page, and "Add to inventory". That opens a
 * new item with the description, the amount (without its sign), and the day of the transaction, and the link.
 *
 * Against the finance backend alone, the request fails: the section then shows only "Add to inventory" (it fails
 * too, with a clear message), as the Documents section does.
 */
@Component({
  selector: 'app-transaction-items',
  imports: [RouterLink, MoneyPipe, IconComponent],
  template: `
    <section aria-labelledby="transaction-items-heading">
      <h3 id="transaction-items-heading" class="h6 mb-2">Home inventory</h3>
      @if (list(); as items) {
        @if (items.length > 0) {
          <ul class="list-group mb-2" data-testid="transaction-items">
            @for (item of items; track item.id) {
              <li class="list-group-item p-0">
                <a class="item-link" [routerLink]="['/home/items', item.id]">
                  <app-icon name="house" [size]="16" class="text-body-secondary" />
                  <span class="flex-grow-1 min-w-0 text-truncate fw-medium">{{ item.name }}</span>
                  <span class="text-nowrap small">{{ item.value | money }}</span>
                </a>
              </li>
            }
          </ul>
        }
      }
      @if (canWrite()) {
        <a
          class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
          routerLink="/home/items/new"
          [queryParams]="newItem()"
          data-testid="add-to-inventory"
        >
          <app-icon name="plus" [size]="16" /> Add to inventory
        </a>
      } @else if (list()?.length === 0) {
        <p class="small text-body-secondary mb-0">Not in the home inventory.</p>
      }
    </section>
  `,
  styles: `
    .item-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      color: inherit;
      text-decoration: none;
      &:hover .fw-medium {
        text-decoration: underline;
      }
    }
    .min-w-0 {
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionItemsComponent {
  private readonly repository = inject(HomeRepository);
  private readonly dataChanges = inject(DataChangesService);
  /** A read-only user (T60) sees the items, without "Add to inventory". */
  readonly canWrite = inject(AuthService).canWrite;

  readonly transaction = input.required<TransactionOutputDto>();
  private readonly transactionId = computed(() => this.transaction().id);

  readonly items = rxResource({
    params: () => ({ id: this.transactionId(), version: this.dataChanges.version() }),
    stream: ({ params }) => this.repository.listByLink(ITEM_TRANSACTION_LINK, params.id),
  });
  readonly list = keptValueOf(this.items);

  /** The address of "Add to inventory": the transaction, its description, amount, and day. */
  readonly newItem = computed(() => {
    const transaction = this.transaction();
    return {
      transactionId: transaction.id,
      name: transaction.description.trim().slice(0, HOME_LIMITS.name),
      price: Math.abs(transaction.amount).toFixed(2),
      date: transaction.date.slice(0, 10),
    };
  });
}
