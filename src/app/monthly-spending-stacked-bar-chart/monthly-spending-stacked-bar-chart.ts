import {Component, OnInit} from '@angular/core';
import {BaseChartDirective} from 'ng2-charts';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Tooltip,
  Legend,
  ChartEvent,
  LegendItem
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import {ChartHelper} from '../../Helpers/chart-helper';
import {ReportsRepository} from '../../Repositories/reports-repository';

Chart.register(CategoryScale, LinearScale, BarElement, BarController, Tooltip, Legend, annotationPlugin);

@Component({
  selector: 'app-monthly-spending-stacked-bar-chart',
  imports: [
    BaseChartDirective,
  ],
  templateUrl: './monthly-spending-stacked-bar-chart.html',
  styleUrl: './monthly-spending-stacked-bar-chart.scss'
})

export class MonthlySpendingStackedBarChart implements OnInit {
  chartData: any = {labels: [], datasets: []};
  chartOptions: any;
  chartType: 'bar' = 'bar';

  isLoading: boolean = true;

  constructor(private reportsRepository: ReportsRepository) {
  }

  ngOnInit(): void {
    this.isLoading = true;

    this.reportsRepository.getMonthlyCategorizedGraph().subscribe((response: any) => {
      this.prepareChartData(response);
    });

  }

  prepareChartData(apiResponse: any): void {
    const { chartData, chartOptions } = ChartHelper.generateChartConfiguration(apiResponse);
    this.chartData = chartData;
    this.chartOptions = chartOptions;
    this.isLoading = false;
  }
}
