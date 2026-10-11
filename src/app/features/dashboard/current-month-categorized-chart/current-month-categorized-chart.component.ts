import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { Router } from '@angular/router';
import { ChartHelper } from '../../../shared/charts/chart-helper';
import { chartTheme } from '../../../shared/charts/chart-theme';
import { categoryLink } from '../dashboard-stats';
import { ThemeService } from '../../../core/theme/theme.service';
import { CategorizedReportOutputDto } from '../../../core/models/outputs/categorized-report-output-dto';

@Component({
  selector: 'app-current-month-categorized-chart',
  templateUrl: './current-month-categorized-chart.component.html',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CurrentMonthCategorizedChartComponent {
  private readonly theme = inject(ThemeService);

  private readonly router = inject(Router);

  readonly report = input.required<CategorizedReportOutputDto>();
  // A slice opens the category's transactions this month, week by week.
  readonly chart = computed(() => {
    const month = this.report().monthlyData[0]?.month;
    return ChartHelper.generateDoughnutChartConfiguration(
      this.report(),
      chartTheme(this.theme.theme()),
      (category) =>
        void this.router.navigate(['/money/transactions'], {
          queryParams: categoryLink(category.id, month),
        }),
    );
  });
}
