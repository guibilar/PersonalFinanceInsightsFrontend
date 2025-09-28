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
import {CategoryColorHelper} from '../../Helpers/category-color-helper';
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
    const months = apiResponse.monthlyData.map((monthData: any) => monthData.month);
    const categories = apiResponse.categories;

    const datasets = categories.map((category: string) => {
      return {
        label: category,
        data: apiResponse.monthlyData.map((monthData: any) => monthData.categoryValues[category] || 0),
        backgroundColor: CategoryColorHelper.getColor(category),
      };
    });

    this.chartData = {
      labels: months,
      datasets: datasets,
    };

    const totalValues = this.chartData.datasets.reduce((sum: number, dataset: any) => {
      return (
        sum +
        dataset.data.reduce((categorySum: number, value: number) => categorySum + value, 0)
      );
    }, 0);

    const averageValue = this.chartData.labels.length > 0 ? totalValues / this.chartData.labels.length : 0;

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          align: 'start',
          labels: {
            color: '#333',
          },
          onClick: (
            event: ChartEvent,
            legendItem: LegendItem,
            legend: any
          ) => {
            const chart = legend.chart;
            const datasets = chart.data.datasets;

            const dataset = datasets.find(
              (ds: any) => ds.label === legendItem.text
            );

            if (dataset) {
              dataset.hidden = !dataset.hidden;
            }

            type Dataset = {
              label: string;
              data: number[];
              hidden?: boolean;
            };

            const visibleData = datasets
              .filter((ds: Dataset) => !ds.hidden);

            const totalSum = visibleData.reduce((total: number, category: any) => {
              const categorySum = category.data.reduce((sum: number, value: string) => sum + value, 0);
              return total + categorySum;
            }, 0);

            const dataPoints = visibleData[0].data.length;

            let newAverage = 0;
            if (visibleData.length > 0) {
              newAverage = totalSum / dataPoints;
            }

            const avgLineAnnotation = chart.options.plugins.annotation.annotations.avgLine;
            if (avgLineAnnotation) {
              avgLineAnnotation.yMin = newAverage;
              avgLineAnnotation.yMax = newAverage;
              avgLineAnnotation.label.content = `Avg: ${newAverage.toFixed(2)}`;
            }

            chart.update();
          },
        },
        annotation: {
          annotations: {
            avgLine: {
              type: 'line',
              borderDash: [6, 3],
              yMin: averageValue,
              yMax: averageValue,
              borderColor: 'red',
              borderWidth: 2,
              label: {
                enabled: true,
                content: `Avg: ${averageValue.toFixed(2)}`,
                position: 'end',
                backgroundColor: 'rgba(255,0,0,0.5)',
              },
            },
          },
        },
      },
    };

    this.isLoading = false;
  }
}
