import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BudgetInputDto } from '../../core/models/inputs/budget-input-dto';
import { Status } from '../../core/models/enums/status';
import { BudgetPeriod } from '../../core/models/enums/budget-period';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';

const NOT_BLANK = Validators.pattern(/\S/);

@Component({
  selector: 'app-budget-form',
  imports: [ReactiveFormsModule],
  templateUrl: './budget-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly budget = input<BudgetOutputDto | null>(null);
  /** True while the parent is saving: blocks a second submit (double-click would create two budgets). */
  readonly saving = input(false);
  readonly submitBudget = output<BudgetInputDto>();
  readonly cancelled = output<void>();

  readonly isEditing = computed(() => this.budget() !== null);

  readonly statusOptions = [
    { value: Status.Active, label: 'Active' },
    { value: Status.Inactive, label: 'Inactive' },
  ];

  readonly periodOptions = [
    {
      value: BudgetPeriod.Total,
      label: 'Total',
      hint: 'Everything linked counts, e.g. a trip or a project.',
    },
    {
      value: BudgetPeriod.Monthly,
      label: 'Monthly',
      hint: 'Only this month’s transactions count; it starts over every month.',
    },
  ];

  readonly form = this.fb.group({
    name: ['', [Validators.required, NOT_BLANK]],
    description: ['', [Validators.required, NOT_BLANK]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    status: [Status.Active, Validators.required],
    period: [BudgetPeriod.Total, Validators.required],
  });

  ngOnInit(): void {
    const budget = this.budget();
    if (budget) {
      this.form.setValue({
        name: budget.name,
        description: budget.description,
        amount: budget.totalAmount,
        status: budget.status,
        period: budget.period,
      });
    }
  }

  isInvalid(control: 'name' | 'description' | 'amount'): boolean {
    const c = this.form.controls[control];
    return c.invalid && c.touched;
  }

  onSubmit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.submitBudget.emit({
      id: this.budget()?.id ?? '',
      name: value.name.trim(),
      description: value.description.trim(),
      amount: value.amount,
      status: value.status,
      period: value.period,
    });
  }
}
