import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { CategorizedReportOutputDto } from '../../../core/models/outputs/categorized-report-output-dto';
import { CategoryColorHelper } from '../../../shared/utils/category-color-helper';
import { CurrentMonthCategorizedChartComponent } from '../current-month-categorized-chart/current-month-categorized-chart.component';
import { categoryShares } from '../dashboard-stats';

/** This month's spending per category: doughnut plus a ranked list with each category's share. */
@Component({
  selector: 'app-category-breakdown',
  imports: [CurrencyPipe, DecimalPipe, CurrentMonthCategorizedChartComponent],
  template: `
    <app-current-month-categorized-chart [report]="report()" />
    <ul class="list-unstyled mb-0 mt-3">
      @for (share of shares(); track share.category) {
        <li class="mb-2">
          <div class="d-flex justify-content-between small">
            <span
              ><span class="category-dot" [style.background-color]="color(share.category)"></span
              >{{ share.category }}</span
            >
            <span class="fw-semibold">
              {{ share.amount | currency }}
              <span class="text-body-secondary fw-normal ms-1"
                >{{ share.percent | number: '1.0-0' }}%</span
              >
            </span>
          </div>
          <div class="progress mt-1" style="height: 0.375rem" role="presentation">
            <div
              class="progress-bar"
              [style.width.%]="share.percent"
              [style.background-color]="color(share.category)"
            ></div>
          </div>
        </li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryBreakdownComponent {
  readonly report = input.required<CategorizedReportOutputDto>();
  readonly shares = computed(() => categoryShares(this.report()));

  color(category: string): string {
    return CategoryColorHelper.getColor(category);
  }
}
