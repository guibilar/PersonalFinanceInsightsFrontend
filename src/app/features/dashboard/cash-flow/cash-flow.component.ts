import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import {
  CHART_THEMES,
  ChartHelper,
  cashFlowColors,
  hasSavingsChange,
} from '../../../shared/charts/chart-helper';
import { ThemeService } from '../../../core/theme/theme.service';
import { CashFlowReportOutputDto } from '../../../core/models/outputs/cash-flow-report-output-dto';

/**
 * Income against spending, and what was left over, per month, with the monthly averages above. How the savings
 * accounts changed is shown too when any account has activity. Every figure is also in a table.
 */
@Component({
  selector: 'app-cash-flow',
  imports: [BaseChartDirective, CurrencyPipe],
  template: `
    <dl
      class="row row-cols-2 g-2 mb-3"
      [class.row-cols-sm-3]="averages().length === 3"
      [class.row-cols-sm-4]="averages().length === 4"
    >
      @for (average of averages(); track average.label) {
        <div class="col">
          <dt class="small text-body-secondary fw-medium">
            <span class="category-dot" [style.background-color]="average.color"></span
            >{{ average.label }}
          </dt>
          <dd class="h5 fw-semibold mb-0" [class.text-danger]="average.amount < 0">
            {{ average.amount | currency }}
          </dd>
        </div>
      }
    </dl>
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
      <div class="small text-body-secondary">
        <p class="mb-1">Averages per month · {{ caption() }}</p>
        <p class="mb-0">
          Left over is income minus spending.
          @if (withSavings()) {
            Savings change is what went into your savings accounts, minus what came out.
          }
        </p>
      </div>
      <div class="btn-group btn-group-sm" role="group" aria-label="Show as">
        <button
          type="button"
          class="btn btn-outline-secondary"
          [class.active]="view() === 'chart'"
          [attr.aria-pressed]="view() === 'chart'"
          (click)="view.set('chart')"
        >
          Chart
        </button>
        <button
          type="button"
          class="btn btn-outline-secondary"
          [class.active]="view() === 'table'"
          [attr.aria-pressed]="view() === 'table'"
          (click)="view.set('table')"
        >
          Table
        </button>
      </div>
    </div>
    @if (view() === 'chart') {
      <div class="chart-container" style="position: relative; width: 100%; height: 20rem">
        <canvas baseChart [data]="chart().chartData" [options]="chart().chartOptions" type="bar">
        </canvas>
      </div>
    } @else {
      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0">
          <caption class="visually-hidden">
            Income, spending and what was left over, per month
          </caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col" class="text-end">Income</th>
              <th scope="col" class="text-end">Spending</th>
              <th scope="col" class="text-end">Left over</th>
              @if (withSavings()) {
                <th scope="col" class="text-end">Savings change</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (month of report().months; track month.month) {
              <tr>
                <th scope="row" class="fw-medium">{{ month.month }}</th>
                <td class="text-end">{{ month.income | currency }}</td>
                <td class="text-end">{{ month.spending | currency }}</td>
                <td class="text-end" [class.text-danger]="month.net < 0">
                  {{ month.net | currency }}
                </td>
                @if (withSavings()) {
                  <td class="text-end">{{ month.savingsChange | currency }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashFlowComponent {
  private readonly theme = inject(ThemeService);

  readonly report = input.required<CashFlowReportOutputDto>();
  readonly view = signal<'chart' | 'table'>('chart');

  readonly withSavings = computed(() => hasSavingsChange(this.report()));

  private readonly colors = computed(() => cashFlowColors(CHART_THEMES[this.theme.theme()]));

  readonly averages = computed(() => {
    const report = this.report();
    const colors = this.colors();
    const averages: { label: string; amount: number; color: string }[] = [
      { label: 'Income', amount: report.averageMonthlyIncome, color: colors.income },
      { label: 'Spending', amount: report.averageMonthlySpending, color: colors.spending },
      { label: 'Left over', amount: report.averageMonthlyNet, color: colors.net },
    ];
    if (this.withSavings()) {
      averages.push({
        label: 'Savings change',
        amount: report.averageMonthlySavingsChange,
        color: colors.savings,
      });
    }
    return averages;
  });

  /** Which months the averages are over, as the API worked them out. */
  readonly caption = computed(() => {
    const { averagedMonths, averagesIncludeCurrentMonth } = this.report();
    if (averagesIncludeCurrentMonth) return 'This month so far';
    return `Over ${averagedMonths} finished month${averagedMonths === 1 ? '' : 's'}`;
  });

  readonly chart = computed(() =>
    ChartHelper.generateCashFlowChartConfiguration(this.report(), CHART_THEMES[this.theme.theme()]),
  );
}
