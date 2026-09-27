import {CategoryColorHelper} from '../../shared/utils/category-color-helper';
import {
  Chart,
  ChartConfiguration,
  ChartData,
  LegendItem
} from 'chart.js';
import {CategorizedReportOutputDto} from '../../core/models/outputs/categorized-report-output-dto';

export class ChartHelper {
  static generateMonthlySpendingChartConfiguration(apiResponse: CategorizedReportOutputDto): {
    chartData: ChartData<'bar'>;
    chartOptions: ChartConfiguration<'bar'>['options']
  } {
    const months = apiResponse.monthlyData.map(monthData => monthData.month);
    const categories = apiResponse.categories;

    const datasets = categories.map(category => {
      return {
        label: category,
        data: apiResponse.monthlyData.map(monthData => monthData.categoryValues[category] || 0),
        backgroundColor: CategoryColorHelper.getColor(category),
      };
    });

    const chartData: ChartData<'bar'> = {
      labels: months,
      datasets: datasets,
    };

    const totalValues = datasets.reduce((sum, dataset) => {
      return (
        sum +
        dataset.data.reduce((categorySum, value) => categorySum + value, 0)
      );
    }, 0);

    const averageValue = months.length > 0 ? totalValues / months.length : 0;

    const chartOptions: ChartConfiguration<'bar'>['options'] = {
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
            generateLabels: (chart: any) => {
              const originalGenerateLabels = Chart.defaults.plugins.legend.labels.generateLabels;
              const labels = originalGenerateLabels(chart);

              labels.push({
                text: `Avg: ${averageValue.toLocaleString('en-CA', {style: 'currency', currency: 'CAD'})}`,
                fillStyle: 'red',
                strokeStyle: 'red',
                lineWidth: 2,
              });

              return labels;
            },
          },
          onClick: (
            event: any,
            legendItem: LegendItem,
            legend: any
          ) => {
            const chart = legend.chart;
            const datasets = chart.data.datasets;

            if (legendItem.text.startsWith('Avg:')) {
              return;
            }

            const dataset = datasets.find(
              (ds: any) => ds.label === legendItem.text
            );

            if (dataset) {
              dataset.hidden = !dataset.hidden;
            }

            const visibleData = datasets.filter((ds: any) => !ds.hidden);

            const totalSum = visibleData.reduce((sum: number, category: any) => {
              return sum + category.data.reduce((sum: number, value: number) => sum + value, 0);
            }, 0);

            const dataPoints = visibleData[0]?.data.length || 0;
            const newAverageValue = dataPoints > 0 ? totalSum / dataPoints : 0;

            chart.options.plugins.legend.labels.generateLabels = (chart: any) => {
              const originalGenerateLabels = Chart.defaults.plugins.legend.labels.generateLabels;
              const labels = originalGenerateLabels(chart);

              labels.push({
                text: `Avg: ${newAverageValue.toLocaleString('en-CA', {style: 'currency', currency: 'CAD'})}`,
                fillStyle: 'red',
                strokeStyle: 'red',
                lineWidth: 2,
                hidden: false,
              });

              return labels;
            };

            const avgLineAnnotation = chart.options.plugins.annotation.annotations.avgLine as any;
            if (avgLineAnnotation) {
              avgLineAnnotation.yMin = newAverageValue;
              avgLineAnnotation.yMax = newAverageValue;
            }

            chart.update();
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              let value = context.raw as number;
              return `${value.toLocaleString('en-CA', {style: 'currency', currency: 'CAD'})}`;
            }
          }
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
            },
          },
        },
      },
    };

    return {chartData, chartOptions};
  }

  static generateDoughnutChartConfiguration(apiResponse: CategorizedReportOutputDto): {
    chartData: ChartData<'doughnut'>;
    chartOptions: ChartConfiguration<'doughnut'>['options'];
  } {
    const categories = apiResponse.categories ?? [];
    const firstMonthData = apiResponse.monthlyData[0]?.categoryValues || {};
    const data = categories.map(category => firstMonthData[category] || 0);

    const chartData: ChartData<'doughnut'> = {
      labels: categories,
      datasets: [
        {
          data: data,
          backgroundColor: categories.map(category =>
            CategoryColorHelper.getColor(category)
          ),
        },
      ],
    };


    const chartOptions: ChartConfiguration<'doughnut'>['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#333',
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              let value = context.raw as number;
              return `${value.toLocaleString('en-CA', {style: 'currency', currency: 'CAD'})}`;
            }
          }
        },
      },
    };

    return { chartData, chartOptions };
  }
}
