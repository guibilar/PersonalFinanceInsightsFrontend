import {Component, signal} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {CardWrapperComponent} from './card-wrapper/card-wrapper.component';
import {MonthlyCategorizedChartComponent} from './monthly-categorized-chart/monthly-categorized-chart.component';
import {
  CurrentMonthCategorizedChartComponent
} from './current-month-categorized-chart/current-month-categorized-chart.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CardWrapperComponent, MonthlyCategorizedChartComponent, CurrentMonthCategorizedChartComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('PersonalFinancesFrontend');
}
