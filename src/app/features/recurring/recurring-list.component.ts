import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { ReportsRepository } from '../../core/api/reports-repository';
import { RecurringPaymentDto } from '../../core/models/outputs/insights-output-dto';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { StatCardComponent } from '../../shared/ui/stat-card/stat-card.component';
import { keptValueOf } from '../../shared/utils/resource-value';
import { DataChangesService } from '../../core/data/data-changes.service';
import { CADENCE_LABELS, recurringStatus, shortDay } from '../../shared/utils/insights';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { formatCurrency } from '../../shared/utils/format';

/**
 * Subscriptions, bills and rent: the payments that come again and again, found in the spending. What they cost a
 * month and a year, when each is next due, which went up, and which seem to have stopped.
 */
@Component({
  selector: 'app-recurring-list',
  imports: [
    MoneyPipe,
    NgTemplateOutlet,
    RouterLink,
    ErrorStateComponent,
    SkeletonComponent,
    StatCardComponent,
  ],
  template: `
    <div class="mb-4">
      <h1 class="h3 mb-1">Subscriptions</h1>
      <p class="text-body-secondary mb-0">
        Payments that come again and again, found in your spending: subscriptions, bills, rent
      </p>
    </div>

    @if (report.error()) {
      <div class="card">
        <div class="card-body">
          <app-error-state
            message="Could not find the recurring payments."
            (retry)="report.reload()"
          />
        </div>
      </div>
    } @else if (value(); as report) {
      <div class="row row-cols-1 row-cols-sm-3 g-3 mb-3">
        <div class="col">
          <app-stat-card
            label="A month"
            icon="calendar"
            [value]="format(report.monthlyTotal)"
            [hint]="countHint()"
          />
        </div>
        <div class="col">
          <app-stat-card
            label="A year"
            icon="trending-up"
            [value]="format(report.yearlyTotal)"
            hint="At today's prices"
          />
        </div>
        <div class="col">
          <app-stat-card
            label="Price changes"
            icon="alert-circle"
            [value]="raised().length === 0 ? 'None' : raised().length + ''"
            [hint]="raised().length === 0 ? 'No fixed price changed lately' : raisedHint()"
            [tone]="raised().length === 0 ? 'neutral' : wentUp() ? 'bad' : 'good'"
          />
        </div>
      </div>

      <div class="card mb-3">
        @if (coming().length === 0) {
          <div class="card-body text-center text-body-secondary py-5">
            <p class="mb-1">No recurring payments found yet.</p>
            <p class="small mb-0">
              They show up once a merchant has charged about the same amount a few times on a
              schedule.
            </p>
          </div>
        } @else {
          <ul class="list-group list-group-flush">
            @for (payment of coming(); track payment.name + payment.cadence + payment.amount) {
              <ng-container
                [ngTemplateOutlet]="row"
                [ngTemplateOutletContext]="{ $implicit: payment }"
              />
            }
          </ul>
        }
      </div>

      @if (stopped().length > 0) {
        <h2 class="h6 text-body-secondary mt-4 mb-2">Stopped</h2>
        <p class="small text-body-secondary">
          No charge for more than a period after one was due: cancelled, most likely.
        </p>
        <div class="card">
          <ul class="list-group list-group-flush">
            @for (payment of stopped(); track payment.name + payment.cadence + payment.amount) {
              <ng-container
                [ngTemplateOutlet]="row"
                [ngTemplateOutletContext]="{ $implicit: payment }"
              />
            }
          </ul>
        </div>
      }
    } @else {
      <div class="card">
        <div class="card-body"><app-skeleton [lines]="6" height="2.5rem" /></div>
      </div>
    }

    <ng-template #row let-payment>
      <li
        class="list-group-item d-flex flex-wrap align-items-center gap-3 py-3"
        [class.opacity-75]="payment.status === 'Stopped'"
      >
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <a
              class="fw-medium text-body text-decoration-none text-truncate"
              routerLink="/money/transactions"
              [queryParams]="{ description: payment.name }"
              [title]="'List the ' + payment.name + ' transactions'"
              >{{ payment.name }}</a
            >
            @if (status(payment); as status) {
              <span class="badge rounded-pill" [class]="'text-bg-' + status.tone">{{
                status.label
              }}</span>
            }
            @if (payment.priceChange; as change) {
              <span
                class="badge rounded-pill"
                [class.text-bg-danger]="change.to > change.from"
                [class.text-bg-success]="change.to < change.from"
              >
                {{ change.to > change.from ? 'Up' : 'Down' }} from {{ change.from | money }}
              </span>
            }
          </div>
          <div class="small text-body-secondary">
            @if (payment.category; as category) {
              <span class="category-dot" [style.background-color]="category.color"></span
              >{{ category.name }} ·
            }
            {{ cadenceLabel(payment) }}
            @if (payment.status === 'Stopped') {
              · last {{ day(payment.lastDate) }}
            } @else {
              · next {{ day(payment.nextDate) }}
            }
          </div>
        </div>
        <div class="text-end">
          <div class="fw-semibold">
            {{ payment.variableAmount ? '~' : '' }}{{ payment.amount | money }}
          </div>
          @if (payment.cadence !== 'Monthly') {
            <div class="small text-body-secondary">{{ payment.monthlyCost | money }}/month</div>
          }
        </div>
      </li>
    </ng-template>
  `,
  styles: `
    .min-w-0 {
      min-width: 0;
    }
    .category-dot {
      display: inline-block;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      margin-right: 0.375rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringListComponent {
  private readonly reports = inject(ReportsRepository);

  /** A statement imported from the sidebar loads them again. */
  private readonly dataChanges = inject(DataChangesService);

  readonly report = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.reports.getRecurring(),
  });
  readonly value = keptValueOf(this.report);

  readonly coming = computed(
    () => this.value()?.payments.filter((p) => p.status !== 'Stopped') ?? [],
  );
  readonly stopped = computed(
    () => this.value()?.payments.filter((p) => p.status === 'Stopped') ?? [],
  );
  readonly raised = computed(() => this.coming().filter((p) => p.priceChange));

  readonly countHint = computed(() => {
    const count = this.coming().length;
    return `${count} recurring ${count === 1 ? 'payment' : 'payments'}`;
  });

  /** The changed prices that went up: red only for those, not for prices that came down. */
  readonly wentUp = computed(() =>
    this.raised().filter((p) => p.priceChange!.to > p.priceChange!.from),
  );
  readonly raisedHint = computed(() => {
    const up = this.wentUp();
    return up.length > 0 ? `${up.map((p) => p.name).join(', ')} went up` : 'Prices went down';
  });

  protected readonly status = recurringStatus;
  protected readonly day = shortDay;

  cadenceLabel(payment: RecurringPaymentDto): string {
    return CADENCE_LABELS[payment.cadence];
  }

  format(amount: number): string {
    return formatCurrency(amount);
  }
}
