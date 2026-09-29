import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BudgetInputDto } from '../../core/models/inputs/budget-input-dto';
import { Status } from '../../core/models/enums/status';
import { BudgetPeriod } from '../../core/models/enums/budget-period';
import { CategoryReference } from '../../core/models/outputs/category-output-dto';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { TEXT_LIMITS } from '../../core/models/text-limits';

const NOT_BLANK = Validators.pattern(/\S/);

@Component({
  selector: 'app-budget-form',
  imports: [ReactiveFormsModule],
  templateUrl: './budget-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly budget = input<BudgetOutputDto | null>(null);
  /** For a monthly budget's categories; the page loads them. */
  readonly categories = input<CategoryReference[]>([]);
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
    name: ['', [Validators.required, NOT_BLANK, Validators.maxLength(TEXT_LIMITS.budgetName)]],
    description: [
      '',
      [Validators.required, NOT_BLANK, Validators.maxLength(TEXT_LIMITS.budgetDescription)],
    ],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    status: [Status.Active, Validators.required],
    period: [BudgetPeriod.Total, Validators.required],
    categoryIds: this.fb.control<string[]>([]),
  });

  protected readonly BudgetPeriod = BudgetPeriod;
  /** The list, and an edited budget's own categories while the list is loading. */
  readonly categoryOptions = computed(() => {
    const categories = this.categories();
    const own = (this.budget()?.categories ?? []).filter(
      (c) => !categories.some((o) => o.id === c.id),
    );
    return [...own, ...categories];
  });
  readonly period = toSignal(this.form.controls.period.valueChanges, {
    initialValue: this.form.controls.period.value,
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
        categoryIds: (budget.categories ?? []).map((c) => c.id),
      });
    }
    // Only a monthly budget can count categories: going back to Total leaves none.
    this.form.controls.period.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((period) => {
        if (period !== BudgetPeriod.Monthly) this.form.controls.categoryIds.setValue([]);
      });
  }

  isCategoryChosen(categoryId: string): boolean {
    return this.form.controls.categoryIds.value.includes(categoryId);
  }

  toggleCategory(categoryId: string, chosen: boolean): void {
    const { categoryIds } = this.form.controls;
    const others = categoryIds.value.filter((id) => id !== categoryId);
    categoryIds.setValue(chosen ? [...others, categoryId] : others);
  }

  readonly limits = TEXT_LIMITS;

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
      categoryIds: value.categoryIds,
    });
  }
}
