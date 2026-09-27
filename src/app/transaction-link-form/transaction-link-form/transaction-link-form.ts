import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TransactionLinkingInputDto} from '../../../Models/Inputs/transaction-input-dto';
import {BudgetOutputDto} from '../../../Models/Outputs/budget-output-dto';

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

  @Input() transaction: any = null;
  @Input() budgets: BudgetOutputDto[] | undefined = [];
  @Output() submitTransaction = new EventEmitter<TransactionLinkingInputDto>();
  @Output() cancel = new EventEmitter<void>();

  formData: TransactionLinkingInputDto = {
    BudgetId: '',
    TransactionId: ''
  };

  ngOnInit(): void {
    if (this.transaction) {
      this.formData = {
        TransactionId: this.transaction.id,
        BudgetId: this.transaction.budgetId === EMPTY_GUID ? '' : this.transaction.budgetId ?? ''
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
    return !!this.formData.BudgetId && this.formData.BudgetId !== EMPTY_GUID;
  }
}
