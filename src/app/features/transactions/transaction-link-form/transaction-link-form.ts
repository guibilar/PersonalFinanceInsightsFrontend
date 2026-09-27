import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TransactionLinkingInputDto} from '../../../core/models/inputs/transaction-linking-input-dto';
import {BudgetOutputDto} from '../../../core/models/outputs/budget-output-dto';
import {TransactionOutputDto} from '../../../core/models/outputs/transaction-output-dto';

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

@Component({
  selector: 'app-transaction-link-form',
  imports: [
    FormsModule
  ],
  templateUrl: './transaction-link-form.html',
  styleUrl: './transaction-link-form.css'
})
export class TransactionLinkForm {

  @Input() transaction: TransactionOutputDto | null = null;
  @Input() budgets: BudgetOutputDto[] | undefined = [];
  @Output() submitTransaction = new EventEmitter<TransactionLinkingInputDto>();
  @Output() cancel = new EventEmitter<void>();

  formData: TransactionLinkingInputDto = {
    budgetId: '',
    transactionId: ''
  };

  ngOnInit(): void {
    if (this.transaction) {
      this.formData = {
        transactionId: this.transaction.id,
        budgetId: this.transaction.budgetId === EMPTY_GUID ? '' : this.transaction.budgetId ?? ''
      };
    }
  }

  onSubmit(): void {
    if (this.isValid()) {
      this.submitTransaction.emit(this.formData);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }

  isValid(): boolean {
    return !!this.formData.budgetId && this.formData.budgetId !== EMPTY_GUID;
  }
}
