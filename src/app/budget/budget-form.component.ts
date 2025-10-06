import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BudgetInputDto } from '../../Models/Inputs/budget-input-dto';
import { Status } from '../../Models/Enums/status';

@Component({
  selector: 'app-budget-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './budget-form.component.html',
  styleUrls: ['./budget-form.component.css']
})
export class BudgetFormComponent implements OnInit {
  @Input() budget: any = null;
  @Output() submitBudget = new EventEmitter<BudgetInputDto>();
  @Output() cancel = new EventEmitter<void>();

  formData: BudgetInputDto = {
    Id: '',
    Name: '',
    Description: '',
    Amount: 0,
    Status: Status.Active
  };

  statusOptions = [
    { value: Status.Active, label: 'Active' },
    { value: Status.Inactive, label: 'Inactive' }
  ];

  ngOnInit(): void {
    if (this.budget) {
      this.formData = {
        Id: this.budget.id,
        Amount: this.budget.totalAmount,
        Name: this.budget.name,
        Description: this.budget.description,
        Status: this.budget.status
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
    return this.formData.Name.trim() !== ''
      && this.formData.Description.trim() !== ''
      && this.formData.Amount > 0
      && this.formData.Status !== undefined;
  }

  get isEditing(): boolean {
    return this.budget !== null;
  }
}
