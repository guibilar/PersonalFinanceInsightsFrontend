import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { CHART_THEMES, ChartHelper } from '../chart-helper';
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

  readonly report = input.required<CategorizedReportOutputDto>();
  readonly chart = computed(() =>
    ChartHelper.generateDoughnutChartConfiguration(this.report(), CHART_THEMES[this.theme.theme()]),
  );
}
