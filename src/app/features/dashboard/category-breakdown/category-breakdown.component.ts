import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { CategorizedReportOutputDto } from '../../../core/models/outputs/categorized-report-output-dto';
import { CurrentMonthCategorizedChartComponent } from '../current-month-categorized-chart/current-month-categorized-chart.component';
import { RouterLink } from '@angular/router';
import { categoryColors, categoryLink, categoryShares } from '../dashboard-stats';

/** This month's spending per category: doughnut plus a ranked list with each category's share. */
@Component({
  selector: 'app-category-breakdown',
  imports: [CurrencyPipe, DecimalPipe, RouterLink, CurrentMonthCategorizedChartComponent],
  template: `
    <app-current-month-categorized-chart [report]="report()" />
    <ul class="list-unstyled mb-0 mt-3">
      @for (share of shares(); track share.category) {
        <li class="mb-2">
          <div class="d-flex justify-content-between small">
            <a
              class="category-link"
              routerLink="/transactions"
              [queryParams]="link(share.category)"
              [title]="'See ' + share.category + ' this month'"
              ><span class="category-dot" [style.background-color]="color(share.category)"></span
              >{{ share.category }}</a
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
  private readonly colors = computed(() => categoryColors(this.report()));

  /** Its transactions this month, week by week. */
  link(category: string): Record<string, string> | null {
    const report = this.report();
    const id = report.categories.find((c) => c.name === category)?.id;
    return id ? categoryLink(id, report.monthlyData[0]?.month) : null;
  }

  color(category: string): string {
    return this.colors()(category);
  }
}
