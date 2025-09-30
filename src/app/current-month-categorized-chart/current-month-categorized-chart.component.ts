import {Component, Input, OnInit} from '@angular/core';
import {BaseChartDirective} from 'ng2-charts';
import {LoaderComponent} from '../loader/loader.component';
import {ReportsRepository} from '../../Repositories/reports-repository';
import {ChartHelper} from '../../Helpers/chart-helper';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(CategoryScale, DoughnutController, Tooltip, Legend, annotationPlugin, ArcElement);

@Component({
  selector: 'app-current-month-categorized-chart',
  templateUrl: './current-month-categorized-chart.component.html',
  imports: [
    BaseChartDirective,
    LoaderComponent
  ]
})

export class CurrentMonthCategorizedChartComponent implements OnInit{
  @Input() chartData: any = {};
  @Input() chartOptions: any = {};
  @Input() chartType: 'doughnut' = 'doughnut';
  @Input() isLoading: boolean = true;

  constructor(private reportsRepository: ReportsRepository) {
  }

  ngOnInit(): void {
    this.isLoading = true;

    this.reportsRepository.getCurrentMonthCategorizedGraph().subscribe((response: any) => {
      this.prepareChartData(response);
    });

  }

  prepareChartData(apiResponse: any): void {
    const { chartData, chartOptions } = ChartHelper.generateDoughnutChartConfiguration(apiResponse);
    this.chartData = chartData;
    this.chartOptions = chartOptions;
    this.isLoading = false;
  }
}
