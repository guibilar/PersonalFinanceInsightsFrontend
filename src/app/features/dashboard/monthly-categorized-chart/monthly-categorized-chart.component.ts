import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {BaseChartDirective} from 'ng2-charts';
import {ChartHelper} from '../chart-helper';
import {CategorizedReportOutputDto} from '../../../core/models/outputs/categorized-report-output-dto';

@Component({
  selector: 'app-monthly-categorized-chart',
  templateUrl: './monthly-categorized-chart.component.html',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthlyCategorizedChartComponent {
  readonly report = input.required<CategorizedReportOutputDto>();
  readonly chart = computed(() => ChartHelper.generateMonthlySpendingChartConfiguration(this.report()));
}
