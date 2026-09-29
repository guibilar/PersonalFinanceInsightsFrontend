import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { Router } from '@angular/router';
import { CHART_THEMES, ChartHelper } from '../chart-helper';
import { categoryLink } from '../dashboard-stats';
import { ThemeService } from '../../../core/theme/theme.service';
import { CategorizedReportOutputDto } from '../../../core/models/outputs/categorized-report-output-dto';

@Component({
  selector: 'app-monthly-categorized-chart',
  templateUrl: './monthly-categorized-chart.component.html',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthlyCategorizedChartComponent {
  private readonly theme = inject(ThemeService);

  private readonly router = inject(Router);

  readonly report = input.required<CategorizedReportOutputDto>();
  // A bar segment opens that category's transactions that month, week by week.
  readonly chart = computed(() =>
    ChartHelper.generateMonthlySpendingChartConfiguration(
      this.report(),
      CHART_THEMES[this.theme.theme()],
      new Date(),
      (category, month) =>
        void this.router.navigate(['/transactions'], {
          queryParams: categoryLink(category.id, month),
        }),
    ),
  );
}
