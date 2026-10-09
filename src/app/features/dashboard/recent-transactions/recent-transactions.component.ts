import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { TransactionType } from '../../../core/models/enums/transaction-type';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';

@Component({
  selector: 'app-recent-transactions',
  imports: [MoneyPipe, DatePipe],
  template: `
    <ul class="list-unstyled mb-0">
      @for (transaction of transactions(); track transaction.id; let last = $last) {
        <li class="d-flex align-items-center gap-3 py-2" [class.border-bottom]="!last">
          <div class="date-chip text-center flex-shrink-0">
            <div class="small text-body-secondary text-uppercase">
              {{ transaction.date | date: 'MMM' : 'UTC' }}
            </div>
            <div class="fw-semibold">{{ transaction.date | date: 'd' : 'UTC' }}</div>
          </div>
          <div class="flex-grow-1 min-w-0">
            <div class="fw-medium text-truncate">{{ transaction.description }}</div>
            <div class="small text-body-secondary">
              <span
                class="category-dot"
                [style.background-color]="transaction.category.color"
              ></span
              >{{ transaction.category.name }}
            </div>
          </div>
          <div
            class="fw-semibold text-nowrap"
            [class.text-success]="transaction.transactionType === TransactionType.Credit"
          >
            {{ transaction.transactionType === TransactionType.Credit ? '+' : '−'
            }}{{ transaction.amount | money }}
          </div>
        </li>
      }
    </ul>
  `,
  styles: `
    .date-chip {
      width: 2.75rem;
      padding: 0.25rem 0;
      border-radius: var(--bs-border-radius);
      background: var(--bs-tertiary-bg);
      line-height: 1.2;
    }
    .min-w-0 {
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentTransactionsComponent {
  readonly transactions = input.required<TransactionOutputDto[]>();

  protected readonly TransactionType = TransactionType;
}
