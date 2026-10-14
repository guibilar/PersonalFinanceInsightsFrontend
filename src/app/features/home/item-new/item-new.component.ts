import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { HomeRepository } from '../../../core/api/home-repository';
import { TransactionRepository } from '../../../core/api/transaction-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { ITEM_TRANSACTION_LINK } from '../../../core/models/outputs/home-output-dto';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { formatDay } from '../../../shared/utils/format';
import { valueOf } from '../../../shared/utils/resource-value';
import { transactionLink } from '../../transactions/transaction-list/transaction-list-query';
import {
  ItemFieldsComponent,
  createItemForm,
  itemDetailsOf,
} from '../item-fields/item-fields.component';
import { HOME_LIMITS, amountOrNull, dayOrNull, guidOrNull, homeError } from '../home';

/**
 * A new item with all its details. Capture and the Home page open it as `/home/items/new`; a room adds `?roomId=`.
 * "Add to inventory" on a transaction (Money) opens it with `?transactionId=<id>&name=…&price=…&date=…`: the form
 * starts with the transaction's description, amount, and day, and the new item links to the transaction.
 */
@Component({
  selector: 'app-item-new',
  imports: [RouterLink, MoneyPipe, IconComponent, ItemFieldsComponent],
  template: `
    <a
      class="back-link small d-inline-flex align-items-center gap-1 mb-2"
      [routerLink]="back().route"
      [queryParams]="back().queryParams"
    >
      ← {{ back().label }}
    </a>
    <h1 class="h3 mb-3">Add item</h1>

    @if (!canWrite()) {
      <p class="alert alert-secondary" data-testid="read-only">
        This account can only read the home inventory.
      </p>
    } @else {
      @if (transactionId) {
        <div class="alert alert-info d-flex align-items-start gap-2" data-testid="link-note">
          <app-icon name="link" [size]="16" class="mt-1" />
          <span>
            The item links to the purchase
            @if (transaction(); as t) {
              <strong>{{ t.description }}</strong> ({{ day(t.date) }}, {{ t.amount | money }}).
            } @else {
              that you came from.
            }
          </span>
        </div>
      }
      <div class="card">
        <div class="card-body">
          <form novalidate (submit)="$event.preventDefault(); save()">
            <app-item-fields [form]="form" [rooms]="rooms()" />
            <div class="d-flex justify-content-end gap-2 mt-3">
              <a
                class="btn btn-outline-secondary"
                [routerLink]="back().route"
                [queryParams]="back().queryParams"
                >Cancel</a
              >
              <button type="submit" class="btn btn-primary" [disabled]="busy()">
                {{ busy() ? 'Adding…' : 'Add item' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: `
    .back-link {
      color: var(--bs-secondary-color);
      text-decoration: none;
      &:hover {
        color: var(--bs-emphasis-color);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemNewComponent {
  private readonly repository = inject(HomeRepository);
  private readonly transactions = inject(TransactionRepository);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly dataChanges = inject(DataChangesService);
  readonly canWrite = inject(AuthService).canWrite;

  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  /** The purchase to link to. An id that is not a GUID is ignored. */
  readonly transactionId = guidOrNull(this.query.get('transactionId'));
  readonly roomId = guidOrNull(this.query.get('roomId'));

  readonly form = createItemForm(undefined, {
    name: (this.query.get('name') ?? '').trim().slice(0, HOME_LIMITS.name),
    roomId: this.roomId,
    purchasedOn: dayOrNull(this.query.get('date')),
    purchasePrice: amountOrNull(this.query.get('price')),
  });
  readonly busy = signal(false);

  private readonly roomsResource = rxResource({
    stream: () => this.repository.rooms(),
  });
  readonly rooms = computed(() => valueOf(this.roomsResource) ?? []);

  /** The transaction, only to name it on the page. */
  private readonly transactionResource = rxResource({
    params: () => this.transactionId ?? undefined,
    stream: ({ params }) => (params ? this.transactions.find(params) : of(null)),
  });
  readonly transaction = computed(() => valueOf(this.transactionResource) ?? null);

  /** Where "back" and "Cancel" go: the transaction, the room, or the Home page. */
  readonly back = computed(() => {
    if (this.transactionId) {
      return { ...transactionLink(this.transactionId), label: 'Transaction' };
    }
    if (this.roomId) return { route: `/home/rooms/${this.roomId}`, queryParams: {}, label: 'Room' };
    return { route: '/home', queryParams: {}, label: 'Home' };
  });

  day(iso: string): string {
    return formatDay(iso);
  }

  save(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.repository
      .create({
        ...itemDetailsOf(this.form),
        links: this.transactionId
          ? [{ kind: ITEM_TRANSACTION_LINK, targetId: this.transactionId }]
          : [],
      })
      .subscribe({
        next: (item) => {
          this.busy.set(false);
          this.dataChanges.changed();
          this.toasts.success(`Added “${item.name}”`);
          void this.router.navigate(['/home/items', item.id]);
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.toasts.error(homeError(error, 'Could not add the item.'));
        },
      });
  }
}
