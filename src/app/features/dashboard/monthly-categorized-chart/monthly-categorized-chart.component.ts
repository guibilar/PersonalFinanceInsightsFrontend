import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { Router } from '@angular/router';
import { ChartHelper } from '../../../shared/charts/chart-helper';
import { chartTheme } from '../../../shared/charts/chart-theme';
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
      chartTheme(this.theme.theme()),
      new Date(),
      (category, month) =>
        void this.router.navigate(['/money/transactions'], {
          queryParams: categoryLink(category.id, month),
        }),
    ),
  );
}
