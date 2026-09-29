import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { CategorizedReportOutputDto } from '../../../core/models/outputs/categorized-report-output-dto';
import { CategoryColorHelper } from '../../../shared/utils/category-color-helper';
import { averageCaption, categoryAverages } from '../dashboard-stats';

/**
 * What each category costs in a typical month: a bar for the average of the finished months, and a thinner one
 * for this month so far, on the same scale so the two can be compared at a glance.
 */
@Component({
  selector: 'app-category-averages',
  imports: [CurrencyPipe, DecimalPipe],
  template: `
    <p class="small text-body-secondary mb-3">
      {{ caption() }}. The thin bar is {{ thisMonthLabel }} so far.
    </p>
    <ul class="list-unstyled mb-0 row row-cols-1 row-cols-lg-2 gx-5">
      @for (row of rows(); track row.category) {
        <li class="col mb-3">
          <div class="d-flex justify-content-between align-items-baseline gap-2 small">
            <span class="text-truncate"
              ><span class="category-dot" [style.background-color]="color(row.category)"></span
              >{{ row.category }}</span
            >
            <span class="text-nowrap">
              <span class="fw-semibold">{{ row.average | currency }}</span>
              <span class="text-body-secondary"> / month</span>
            </span>
          </div>
          <div
            class="progress mt-1"
            style="height: 0.5rem"
            role="img"
            [attr.aria-label]="
              row.category +
              ': average ' +
              (row.average | currency) +
              ' a month, ' +
              (row.thisMonth | currency) +
              ' this month'
            "
          >
            <div
              class="progress-bar"
              [style.width.%]="percent(row.average)"
              [style.background-color]="color(row.category)"
            ></div>
          </div>
          <div class="progress mt-1 bg-transparent" style="height: 0.25rem" role="presentation">
            <div
              class="progress-bar bg-body-secondary border border-secondary-subtle"
              [style.width.%]="percent(row.thisMonth)"
            ></div>
          </div>
          <div class="d-flex justify-content-between small text-body-secondary mt-1">
            <span>{{ row.thisMonth | currency }} this month</span>
            @if (row.change !== null) {
              <!-- Only over the average is flagged: a month still running is expected to be under it. -->
              <span [class.text-danger]="row.change > 10">
                {{ row.change >= 0 ? '+' : '−' }}{{ absolute(row.change) | number: '1.0-0' }}% vs
                average
              </span>
            }
          </div>
        </li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryAveragesComponent {
  readonly report = input.required<CategorizedReportOutputDto>();
  readonly today = input(new Date());

  readonly rows = computed(() => categoryAverages(this.report(), this.today()));
  readonly caption = computed(() =>
    averageCaption(
      this.report().monthlyData.map((month) => month.month),
      this.today(),
    ),
  );
  /** Both bars share one scale: the largest value on show. */
  private readonly max = computed(() =>
    Math.max(0, ...this.rows().flatMap((row) => [row.average, row.thisMonth])),
  );

  get thisMonthLabel(): string {
    return this.today().toLocaleString('en-CA', { month: 'long' });
  }

  color(category: string): string {
    return CategoryColorHelper.getColor(category);
  }

  percent(amount: number): number {
    const max = this.max();
    return max > 0 ? (amount / max) * 100 : 0;
  }

  absolute(value: number): number {
    return Math.abs(value);
  }
}
