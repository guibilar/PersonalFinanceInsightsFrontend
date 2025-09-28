import {Component, Input, OnInit} from '@angular/core';
import {BaseChartDirective} from 'ng2-charts';
import {LoaderComponent} from '../loader/loader.component';
import {ReportsRepository} from '../../Repositories/reports-repository';
import {ChartHelper} from '../../Helpers/chart-helper';
import {BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(CategoryScale, LinearScale, BarElement, BarController, Tooltip, Legend, annotationPlugin);

@Component({
  selector: 'app-monthly-categorized-chart',
  templateUrl: './monthly-categorized-chart.component.html',
  imports: [
    BaseChartDirective,
    LoaderComponent
  ]
})

export class MonthlyCategorizedChartComponent implements OnInit{
  @Input() chartData: any = {};
  @Input() chartOptions: any = {};
  @Input() chartType: 'bar' = 'bar';
  @Input() isLoading: boolean = true;

  constructor(private reportsRepository: ReportsRepository) {
  }

  ngOnInit(): void {
    this.isLoading = true;

    this.reportsRepository.getMonthlyCategorizedGraph().subscribe((response: any) => {
      this.prepareChartData(response);
    });

  }

  prepareChartData(apiResponse: any): void {
    const { chartData, chartOptions } = ChartHelper.generateMonthlySpendingChartConfiguration(apiResponse);
    this.chartData = chartData;
    this.chartOptions = chartOptions;
    this.isLoading = false;
  }
}
