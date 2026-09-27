import {Component, Input, OnChanges} from '@angular/core';
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration, ChartData} from 'chart.js';
import {LoaderComponent} from '../../../shared/ui/loader/loader.component';
import {ChartHelper} from '../chart-helper';
import {CategorizedReportOutputDto} from '../../../core/models/outputs/categorized-report-output-dto';

@Component({
  selector: 'app-current-month-categorized-chart',
  templateUrl: './current-month-categorized-chart.component.html',
  imports: [
    BaseChartDirective,
    LoaderComponent
  ]
})
export class CurrentMonthCategorizedChartComponent implements OnChanges {
  @Input() report?: CategorizedReportOutputDto;

  chartData?: ChartData<'doughnut'>;
  chartOptions: ChartConfiguration<'doughnut'>['options'] = {};
  readonly chartType = 'doughnut' as const;

  ngOnChanges(): void {
    if (!this.report) {
      return;
    }
    const { chartData, chartOptions } = ChartHelper.generateDoughnutChartConfiguration(this.report);
    this.chartData = chartData;
    this.chartOptions = chartOptions;
  }
}
