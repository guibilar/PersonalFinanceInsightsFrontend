import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { BudgetOutputDto } from '../../../core/models/outputs/budget-output-dto';

/** Active budgets, most used first, with their progress. */
@Component({
  selector: 'app-budget-overview',
  imports: [CurrencyPipe, DecimalPipe],
  template: `
    <ul class="list-unstyled mb-0">
      @for (budget of sorted(); track budget.id) {
        <li class="mb-3">
          <div class="d-flex justify-content-between small mb-1">
            <span class="fw-medium">{{ budget.name }}</span>
            <span [class.text-danger]="budget.percentageUsed >= 100" class="fw-semibold">
              {{ budget.totalSpent | currency }}
              <span class="text-body-secondary fw-normal"
                >/ {{ budget.totalAmount | currency
                }}{{ budget.period === 'Monthly' ? ' this month' : '' }}</span
              >
            </span>
          </div>
          <div
            class="progress"
            style="height: 0.5rem"
            role="progressbar"
            [attr.aria-label]="budget.name + ' used'"
            [attr.aria-valuenow]="budget.percentageUsed"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="progress-bar"
              [class.bg-warning]="budget.percentageUsed >= 80 && budget.percentageUsed < 100"
              [class.bg-danger]="budget.percentageUsed >= 100"
              [style.width.%]="min(budget.percentageUsed, 100)"
            ></div>
          </div>
          <p class="small text-body-secondary mt-1 mb-0">
            @if (budget.totalRemaining >= 0) {
              {{ budget.totalRemaining | currency }} left ·
              {{ budget.percentageUsed | number: '1.0-0' }}% used
            } @else {
              {{ -budget.totalRemaining | currency }} over budget
            }
          </p>
        </li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetOverviewComponent {
  readonly budgets = input.required<BudgetOutputDto[]>();
  readonly sorted = computed(() =>
    [...this.budgets()].sort((a, b) => b.percentageUsed - a.percentageUsed),
  );

  protected readonly min = Math.min;
}
