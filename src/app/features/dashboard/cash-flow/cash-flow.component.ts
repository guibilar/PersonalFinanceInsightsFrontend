import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { CASH_FLOW_COLORS, CHART_THEMES, ChartHelper, hasSavingsChange } from '../chart-helper';
import { ThemeService } from '../../../core/theme/theme.service';
import { CashFlowReportOutputDto } from '../../../core/models/outputs/cash-flow-report-output-dto';

/**
 * Income against spending, and what was left over, per month, with the monthly averages above. How the savings
 * accounts changed is shown too when any account has activity.
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
    <p class="small text-body-secondary mb-1">Averages per month · {{ caption() }}</p>
    <p class="small text-body-secondary mb-2">
      Left over is income minus spending.
      @if (withSavings()) {
        Savings change is what went into your savings accounts, minus what came out.
      }
    </p>
    <div class="chart-container" style="position: relative; width: 100%; height: 20rem">
      <canvas baseChart [data]="chart().chartData" [options]="chart().chartOptions" type="bar">
      </canvas>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashFlowComponent {
  private readonly theme = inject(ThemeService);

  readonly report = input.required<CashFlowReportOutputDto>();

  readonly withSavings = computed(() => hasSavingsChange(this.report()));

  readonly averages = computed(() => {
    const report = this.report();
    const averages: { label: string; amount: number; color: string }[] = [
      { label: 'Income', amount: report.averageMonthlyIncome, color: CASH_FLOW_COLORS.income },
      {
        label: 'Spending',
        amount: report.averageMonthlySpending,
        color: CASH_FLOW_COLORS.spending,
      },
      { label: 'Left over', amount: report.averageMonthlyNet, color: CASH_FLOW_COLORS.net },
    ];
    if (this.withSavings()) {
      averages.push({
        label: 'Savings change',
        amount: report.averageMonthlySavingsChange,
        color: CASH_FLOW_COLORS.savings,
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
