import {CategoryColorHelper} from './category-color-helper';
import {
  Chart,
  ChartConfiguration,
  LegendItem
} from 'chart.js';

export class ChartHelper {
  static generateMonthlySpendingChartConfiguration(apiResponse: any): {
    chartData: any;
    chartOptions: ChartConfiguration['options']
  } {
    const months = apiResponse.monthlyData.map((monthData: any) => monthData.month);
    const categories = apiResponse.categories;

    const datasets = categories.map((category: string) => {
      return {
        label: category,
        data: apiResponse.monthlyData.map((monthData: any) => monthData.categoryValues[category] || 0),
        backgroundColor: CategoryColorHelper.getColor(category),
      };
    });

    const chartData = {
      labels: months,
      datasets: datasets,
    };

    const totalValues = datasets.reduce((sum: number, dataset: any) => {
      return (
        sum +
        dataset.data.reduce((categorySum: number, value: number) => categorySum + value, 0)
      );
    }, 0);

    const averageValue = months.length > 0 ? totalValues / months.length : 0;

    const chartOptions: ChartConfiguration['options'] = {
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

  static generateDoughnutChartConfiguration(apiResponse: any): {
    chartData: any;
    chartOptions: ChartConfiguration['options'];
  } {
    const categories = apiResponse.categories || [];
    const firstMonthData = apiResponse.monthlyData[0]?.categoryValues || {};
    const data = categories.map((category: string) => firstMonthData[category] || 0);

    const chartData = {
      labels: categories,
      datasets: [
        {
          data: data,
          backgroundColor: categories.map((category: string) =>
            CategoryColorHelper.getColor(category)
          ),
        },
      ],
    };


    const chartOptions: ChartConfiguration['options'] = {
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
