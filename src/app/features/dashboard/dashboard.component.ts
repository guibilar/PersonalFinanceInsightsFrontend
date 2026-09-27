import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { CardWrapperComponent } from '../../shared/ui/card-wrapper/card-wrapper.component';
import { MonthlyCategorizedChartComponent } from './monthly-categorized-chart/monthly-categorized-chart.component';
import { CurrentMonthCategorizedTableComponent } from './current-month-categorized-table/current-month-categorized-table.component';
import { CurrentMonthCategorizedChartComponent } from './current-month-categorized-chart/current-month-categorized-chart.component';
import { ReportsRepository } from '../../core/api/reports-repository';
import { LoaderComponent } from '../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';

// Registered here so Chart.js only ships in the lazily loaded dashboard chunk.
Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend,
  annotationPlugin,
);

@Component({
  selector: 'app-dashboard',
  imports: [
    CardWrapperComponent,
    MonthlyCategorizedChartComponent,
    CurrentMonthCategorizedTableComponent,
    CurrentMonthCategorizedChartComponent,
    LoaderComponent,
    ErrorStateComponent,
  ],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly reportsRepository = inject(ReportsRepository);

  readonly monthlyReport = rxResource({
    stream: () => this.reportsRepository.getMonthlyCategorizedGraph(),
  });

  // Fetched once and shared by the table and the doughnut chart.
  readonly currentMonthReport = rxResource({
    stream: () => this.reportsRepository.getCurrentMonthCategorizedGraph(),
  });
}
