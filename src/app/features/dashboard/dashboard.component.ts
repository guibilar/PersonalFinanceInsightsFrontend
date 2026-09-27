import { Component, OnInit } from '@angular/core';
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
import { CardWrapperComponent } from '../../shared/ui/card-wrapper/card-wrapper.component';
import { MonthlyCategorizedChartComponent } from './monthly-categorized-chart/monthly-categorized-chart.component';
import { CurrentMonthCategorizedTableComponent } from './current-month-categorized-table/current-month-categorized-table.component';
import { CurrentMonthCategorizedChartComponent } from './current-month-categorized-chart/current-month-categorized-chart.component';
import { ReportsRepository } from '../../core/api/reports-repository';
import { CategorizedReportOutputDto } from '../../core/models/outputs/categorized-report-output-dto';

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
  annotationPlugin
);

@Component({
  selector: 'app-dashboard',
  imports: [
    CardWrapperComponent,
    MonthlyCategorizedChartComponent,
    CurrentMonthCategorizedTableComponent,
    CurrentMonthCategorizedChartComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  monthlyReport?: CategorizedReportOutputDto;
  currentMonthReport?: CategorizedReportOutputDto;

  constructor(private reportsRepository: ReportsRepository) {}

  ngOnInit(): void {
    this.reportsRepository.getMonthlyCategorizedGraph().subscribe({
      next: (report) => (this.monthlyReport = report),
      error: (error) => console.error('Error loading monthly report:', error)
    });

    // Fetched once and shared by the table and the doughnut chart.
    this.reportsRepository.getCurrentMonthCategorizedGraph().subscribe({
      next: (report) => (this.currentMonthReport = report),
      error: (error) => console.error('Error loading current month report:', error)
    });
  }
}
