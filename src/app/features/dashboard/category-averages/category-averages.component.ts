import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CategorizedReportOutputDto } from '../../../core/models/outputs/categorized-report-output-dto';
import { RouterLink } from '@angular/router';
import { averageCaption, categoryAverages, categoryColors, categoryLink } from '../dashboard-stats';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

/**
 * What each category costs in a typical month: a bar for the average of the finished months, and a thinner one
 * for this month so far, on the same scale so the two can be compared at a glance.
 */
@Component({
  selector: 'app-category-averages',
  imports: [MoneyPipe, DecimalPipe, RouterLink],
  template: `
    @if (rows().length > 0) {
      <p class="small text-body-secondary mb-3">
        {{ caption() }}. The thin bar is {{ thisMonthLabel }} so far.
      </p>
    } @else {
      <p class="small text-body-secondary mb-0">
        A usual month for each category shows once a month of the year is over.
      </p>
    }
    <ul class="list-unstyled mb-0 row row-cols-1 row-cols-lg-2 gx-5">
      @for (row of rows(); track row.category) {
        <li class="col mb-3">
          <div class="d-flex justify-content-between align-items-baseline gap-2 small">
            <a
              class="category-link text-truncate"
              routerLink="/transactions"
              [queryParams]="link(row.category)"
              [title]="'See ' + row.category + ' over time'"
              ><span class="category-dot" [style.background-color]="color(row.category)"></span
              >{{ row.category }}</a
            >
            <span class="text-nowrap">
              <span class="fw-semibold">{{ row.average | money }}</span>
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
              (row.average | money) +
              ' a month, ' +
              (row.thisMonth | money) +
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
            <span>{{ row.thisMonth | money }} this month</span>
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

  private readonly colors = computed(() => categoryColors(this.report()));

  /** All of its history, month by month. */
  link(category: string): Record<string, string> | null {
    const id = this.report().categories.find((c) => c.name === category)?.id;
    return id ? categoryLink(id) : null;
  }

  color(category: string): string {
    return this.colors()(category);
  }

  percent(amount: number): number {
    const max = this.max();
    return max > 0 ? (amount / max) * 100 : 0;
  }

  absolute(value: number): number {
    return Math.abs(value);
  }
}
