import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SpendingForecastDto } from '../../../core/models/outputs/insights-output-dto';
import { changeText, compared, shortDay } from '../../../shared/utils/insights';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { formatCurrency } from '../../../shared/utils/format';

/** How many upcoming charges are listed; the rest are on the Subscriptions page. */
const UPCOMING_SHOWN = 4;

/**
 * Where this month is heading: what is spent, the recurring payments still due and usual day-to-day spending for the
 * days left, against a usual month; and the monthly and yearly budgets that look like going over.
 */
@Component({
  selector: 'app-month-forecast',
  imports: [MoneyPipe, DecimalPipe, RouterLink],
  template: `
    @let f = forecast();
    <div class="d-flex flex-wrap align-items-baseline gap-2 mb-1">
      <span class="h3 fw-semibold mb-0">{{ f.projected | money }}</span>
      <span class="text-body-secondary">by the end of the month</span>
    </div>
    @if (vsUsual(); as vs) {
      <p
        class="small mb-3"
        [class.text-danger]="vs.up"
        [class.text-success]="!vs.up && vs.text !== 'about the same'"
      >
        {{ compare(vs, 'usual') }} ({{ f.usual | money }}, the average of the last
        {{ f.usualMonths === 1 ? 'month' : f.usualMonths + ' months' }})
      </p>
    } @else if (f.usual === null) {
      <p class="small text-body-secondary mb-3">No complete month yet to compare with.</p>
    } @else {
      <!-- Complete months there are, but refunds outweighed the spending: no fair percentage to give. -->
      <p class="small text-body-secondary mb-3">
        A usual month came to {{ f.usual | money }} (the average of the last
        {{ f.usualMonths === 1 ? 'month' : f.usualMonths + ' months' }}).
      </p>
    }

    <div class="progress-stacked forecast-bar mb-2" role="img" [attr.aria-label]="barLabel()">
      <div class="progress" [style.width.%]="share(f.spent)">
        <div class="progress-bar"></div>
      </div>
      <div class="progress" [style.width.%]="share(upcomingTotal())">
        <div class="progress-bar bg-warning"></div>
      </div>
      <div class="progress" [style.width.%]="share(dayToDay())">
        <div class="progress-bar bg-primary-subtle"></div>
      </div>
    </div>
    <ul class="list-inline small text-body-secondary mb-3">
      <li class="list-inline-item me-3">
        <span class="key bg-primary"></span>Spent {{ f.spent | money }}
      </li>
      <li class="list-inline-item me-3">
        <span class="key bg-warning"></span>Recurring still due {{ upcomingTotal() | money }}
      </li>
      <li class="list-inline-item">
        <span class="key bg-primary-subtle border"></span>Day-to-day, {{ f.daysLeft }}
        {{ f.daysLeft === 1 ? 'day' : 'days' }} at {{ f.dailyRate | money }} a day:
        {{ dayToDay() | money }}
      </li>
    </ul>

    <div class="row g-3">
      <div class="col-12 col-md-6">
        <h3 class="h6 mb-2">Still to come</h3>
        @if (f.upcoming.length === 0) {
          <p class="small text-body-secondary mb-0">
            No recurring payment is due before the month ends.
          </p>
        } @else {
          <ul class="list-unstyled small mb-1">
            @for (charge of upcomingShown(); track charge.name + charge.date) {
              <li class="d-flex justify-content-between gap-2 mb-1">
                <span class="text-truncate"
                  >{{ charge.name }}
                  <span class="text-body-secondary">· {{ day(charge.date) }}</span></span
                >
                <span class="text-nowrap">{{ charge.amount | money }}</span>
              </li>
            }
          </ul>
          @if (f.upcoming.length > upcomingShown().length) {
            <a routerLink="/subscriptions" class="small text-decoration-none"
              >and {{ f.upcoming.length - upcomingShown().length }} more</a
            >
          }
        }
      </div>
      <div class="col-12 col-md-6">
        <h3 class="h6 mb-2">Budgets at this pace</h3>
        @if (f.budgets.length === 0) {
          <p class="small text-body-secondary mb-0">
            No monthly or yearly budget that counts by category or merchant.
          </p>
        } @else {
          <ul class="list-unstyled small mb-0">
            @for (budget of f.budgets; track budget.budgetId) {
              <li class="d-flex justify-content-between gap-2 mb-1">
                <span class="text-truncate">{{ budget.name }}</span>
                <span
                  class="text-nowrap fw-medium"
                  [class.text-danger]="budget.projectedPercentage > 100"
                  [class.text-warning-emphasis]="
                    budget.projectedPercentage > 90 && budget.projectedPercentage <= 100
                  "
                  [title]="'Spent ' + format(budget.spent) + ' of ' + format(budget.amount)"
                >
                  {{ budget.projected | money }} of {{ budget.amount | money }} ({{
                    budget.projectedPercentage | number: '1.0-0'
                  }}%)
                </span>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  styles: `
    .forecast-bar {
      height: 0.75rem;
    }
    .key {
      display: inline-block;
      width: 0.625rem;
      height: 0.625rem;
      border-radius: 0.125rem;
      margin-right: 0.375rem;
      vertical-align: baseline;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthForecastComponent {
  readonly forecast = input.required<SpendingForecastDto>();

  readonly upcomingTotal = computed(() =>
    this.forecast().upcoming.reduce((sum, c) => sum + c.amount, 0),
  );
  /** What the days left add at the usual pace: the projection less what is spent and due. */
  readonly dayToDay = computed(() =>
    Math.max(0, this.forecast().projected - this.forecast().spent - this.upcomingTotal()),
  );
  readonly upcomingShown = computed(() => this.forecast().upcoming.slice(0, UPCOMING_SHOWN));

  readonly vsUsual = computed(() => {
    const { projected, usual } = this.forecast();
    return usual === null ? null : changeText(projected, usual);
  });

  readonly barLabel = computed(
    () =>
      `Spent ${this.format(this.forecast().spent)}, ${this.format(this.upcomingTotal())} of recurring payments due, ` +
      `${this.format(this.dayToDay())} day-to-day to come`,
  );

  protected readonly day = shortDay;
  protected readonly compare = compared;

  share(amount: number): number {
    const projected = this.forecast().projected;
    return projected > 0 ? Math.max(0, (amount / projected) * 100) : 0;
  }

  format(amount: number): string {
    return formatCurrency(amount);
  }
}
