import {Component, signal} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {CardWrapperComponent} from './card-wrapper/card-wrapper.component';
import {MonthlyCategorizedChartComponent} from './monthly-categorized-chart/monthly-categorized-chart.component';
import {
  CurrentMonthCategorizedChartComponent
} from './current-month-categorized-chart/current-month-categorized-chart.component';
import {
  CurrentMonthCategorizedTableComponent
} from './current-month-categorized-table/current-month-categorized-table.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CardWrapperComponent, MonthlyCategorizedChartComponent, CurrentMonthCategorizedChartComponent,
    CurrentMonthCategorizedTableComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('PersonalFinancesFrontend');
}
