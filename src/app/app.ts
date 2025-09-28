import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {MonthlySpendingStackedBarChart} from './monthly-spending-stacked-bar-chart/monthly-spending-stacked-bar-chart';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MonthlySpendingStackedBarChart],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('PersonalFinancesFrontend');
}
