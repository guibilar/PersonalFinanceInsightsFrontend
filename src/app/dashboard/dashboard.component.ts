import { Component } from '@angular/core';
import { CardWrapperComponent } from '../card-wrapper/card-wrapper.component';
import { MonthlyCategorizedChartComponent } from '../monthly-categorized-chart/monthly-categorized-chart.component';
import { CurrentMonthCategorizedTableComponent } from '../current-month-categorized-table/current-month-categorized-table.component';
import { CurrentMonthCategorizedChartComponent } from '../current-month-categorized-chart/current-month-categorized-chart.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CardWrapperComponent,
    MonthlyCategorizedChartComponent,
    CurrentMonthCategorizedTableComponent,
    CurrentMonthCategorizedChartComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
}
