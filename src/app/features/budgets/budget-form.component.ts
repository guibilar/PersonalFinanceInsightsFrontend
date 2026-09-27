import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BudgetInputDto } from '../../core/models/inputs/budget-input-dto';
import { Status } from '../../core/models/enums/status';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';

@Component({
  selector: 'app-budget-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './budget-form.component.html',
  styleUrls: ['./budget-form.component.css']
})
export class BudgetFormComponent implements OnInit {
  @Input() budget: BudgetOutputDto | null = null;
  @Output() submitBudget = new EventEmitter<BudgetInputDto>();
  @Output() cancel = new EventEmitter<void>();

  formData: BudgetInputDto = {
    id: '',
    name: '',
    description: '',
    amount: 0,
    status: Status.Active
  };

  statusOptions = [
    { value: Status.Active, label: 'Active' },
    { value: Status.Inactive, label: 'Inactive' }
  ];

  ngOnInit(): void {
    if (this.budget) {
      this.formData = {
        id: this.budget.id,
        amount: this.budget.totalAmount,
        name: this.budget.name,
        description: this.budget.description,
        status: this.budget.status
      };
    }
  }

  onSubmit(): void {
    if (this.isValid()) {
      this.submitBudget.emit(this.formData);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }

  isValid(): boolean {
    return this.formData.name.trim() !== ''
      && this.formData.description.trim() !== ''
      && this.formData.amount > 0
      && this.formData.status !== undefined;
  }

  get isEditing(): boolean {
    return this.budget !== null;
  }
}
