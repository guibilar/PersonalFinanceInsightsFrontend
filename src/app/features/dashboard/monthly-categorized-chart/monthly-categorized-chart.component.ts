import {Component, Input, OnChanges} from '@angular/core';
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration, ChartData} from 'chart.js';
import {LoaderComponent} from '../../../shared/ui/loader/loader.component';
import {ChartHelper} from '../chart-helper';
import {CategorizedReportOutputDto} from '../../../core/models/outputs/categorized-report-output-dto';

@Component({
  selector: 'app-monthly-categorized-chart',
  templateUrl: './monthly-categorized-chart.component.html',
  imports: [
    BaseChartDirective,
    LoaderComponent
  ]
})
export class MonthlyCategorizedChartComponent implements OnChanges {
  @Input() report?: CategorizedReportOutputDto;

  chartData?: ChartData<'bar'>;
  chartOptions: ChartConfiguration<'bar'>['options'] = {};
  readonly chartType = 'bar' as const;

  ngOnChanges(): void {
    if (!this.report) {
      return;
    }
    const { chartData, chartOptions } = ChartHelper.generateMonthlySpendingChartConfiguration(this.report);
    this.chartData = chartData;
    this.chartOptions = chartOptions;
  }
}
