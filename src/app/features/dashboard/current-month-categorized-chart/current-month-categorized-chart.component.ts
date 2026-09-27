import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {BaseChartDirective} from 'ng2-charts';
import {ChartHelper} from '../chart-helper';
import {CategorizedReportOutputDto} from '../../../core/models/outputs/categorized-report-output-dto';

@Component({
  selector: 'app-current-month-categorized-chart',
  templateUrl: './current-month-categorized-chart.component.html',
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CurrentMonthCategorizedChartComponent {
  readonly report = input.required<CategorizedReportOutputDto>();
  readonly chart = computed(() => ChartHelper.generateDoughnutChartConfiguration(this.report()));
}
