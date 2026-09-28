import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { CASH_FLOW_COLORS, CHART_THEMES, ChartHelper } from '../chart-helper';
import { averageCaption } from '../dashboard-stats';
import { ThemeService } from '../../../core/theme/theme.service';
import { CashFlowReportOutputDto } from '../../../core/models/outputs/cash-flow-report-output-dto';

/** Income against spending (and what went to savings) per month, with the monthly averages above. */
@Component({
  selector: 'app-cash-flow',
  imports: [BaseChartDirective, CurrencyPipe],
  template: `
    <dl class="row row-cols-1 row-cols-sm-3 g-2 mb-3">
      @for (average of averages(); track average.label) {
        <div class="col">
          <dt class="small text-body-secondary fw-medium">
            <span class="category-dot" [style.background-color]="average.color"></span
            >{{ average.label }}
          </dt>
          <dd class="h5 fw-semibold mb-0">{{ average.amount | currency }}</dd>
        </div>
      }
    </dl>
    <p class="small text-body-secondary mb-2">Averages per month · {{ caption() }}</p>
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
  /** For the caption; the API decides which months the averages cover. */
  readonly today = input(new Date());

  readonly averages = computed(() => {
    const report = this.report();
    return [
      { label: 'Income', amount: report.averageMonthlyIncome, color: CASH_FLOW_COLORS.income },
      {
        label: 'Spending',
        amount: report.averageMonthlySpending,
        color: CASH_FLOW_COLORS.spending,
      },
      { label: 'Saved', amount: report.averageMonthlySaved, color: CASH_FLOW_COLORS.saved },
    ];
  });

  readonly caption = computed(() =>
    averageCaption(
      this.report().months.map((month) => month.month),
      this.today(),
    ),
  );

  readonly chart = computed(() =>
    ChartHelper.generateCashFlowChartConfiguration(this.report(), CHART_THEMES[this.theme.theme()]),
  );
}
