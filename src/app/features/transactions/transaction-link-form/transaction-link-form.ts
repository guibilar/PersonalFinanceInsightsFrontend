import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TransactionLinkingInputDto } from '../../../core/models/inputs/transaction-linking-input-dto';
import { BudgetOutputDto } from '../../../core/models/outputs/budget-output-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

function notEmptyGuid(control: AbstractControl<string>): ValidationErrors | null {
  return control.value === EMPTY_GUID ? { emptyGuid: true } : null;
}

@Component({
  selector: 'app-transaction-link-form',
  imports: [ReactiveFormsModule, CurrencyPipe, DatePipe],
  templateUrl: './transaction-link-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionLinkForm implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly transaction = input.required<TransactionOutputDto>();
  readonly budgets = input<BudgetOutputDto[]>([]);
  /** True while the parent is linking: blocks a second submit. */
  readonly saving = input(false);
  readonly submitTransaction = output<TransactionLinkingInputDto>();
  readonly cancelled = output<void>();

  readonly form = this.fb.group({
    budgetId: ['', [Validators.required, notEmptyGuid]],
  });

  ngOnInit(): void {
    const budgetId = this.transaction().budgetId;
    if (budgetId && budgetId !== EMPTY_GUID) {
      this.form.setValue({ budgetId });
    }
  }

  onSubmit(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.submitTransaction.emit({
      transactionId: this.transaction().id,
      budgetId: this.form.getRawValue().budgetId,
    });
  }
}
