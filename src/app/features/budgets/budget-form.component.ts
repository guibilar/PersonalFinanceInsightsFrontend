import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { BudgetInputDto } from '../../core/models/inputs/budget-input-dto';
import { Status } from '../../core/models/enums/status';
import { BudgetPeriod } from '../../core/models/enums/budget-period';
import { CategoryReference } from '../../core/models/outputs/category-output-dto';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { TEXT_LIMITS } from '../../core/models/text-limits';
import { cents } from '../../shared/utils/cents';
import { yearStillTyped } from '../../shared/utils/date-presets';

const NOT_BLANK = Validators.pattern(/\S/);
/** The largest budget the API accepts (Finance.Contracts `BudgetInputDto`). */
const MAX_AMOUNT = 1_000_000_000;

/** A custom period needs its two days, the last not before the first (`yyyy-MM-dd` compares as text). */
const CUSTOM_DAYS: ValidatorFn = (group): ValidationErrors | null => {
  const { period, startDate, endDate } = group.getRawValue();
  if (period !== BudgetPeriod.Custom) return null;
  if (!startDate || !endDate) return { daysMissing: true };
  // A year still being typed (0202-…) isn't the day meant, so it isn't out of order yet; it can't be saved either.
  if (yearStillTyped(startDate) || yearStillTyped(endDate)) return { daysYear: true };
  return startDate > endDate ? { daysOrder: true } : null;
};

/** The day of an API date (`yyyy-MM-dd…`) for a date input. */
const day = (date: string | null | undefined): string => date?.slice(0, 10) ?? '';

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
  /** For the categories a budget can count; the page loads them. */
  readonly categories = input<CategoryReference[]>([]);
  /** True while the parent is saving: blocks a second submit (double-click would create two budgets). */
  readonly saving = input(false);
  readonly submitBudget = output<BudgetInputDto>();
  readonly cancelled = output<void>();

  readonly isEditing = computed(() => this.budget() !== null);
  /** Save was pressed: a year left half-typed is pointed out then, not while it is being typed. */
  private readonly submitted = signal(false);

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
    {
      value: BudgetPeriod.Yearly,
      label: 'Yearly',
      hint: 'Only this year’s transactions count; it starts over every year.',
    },
    {
      value: BudgetPeriod.Custom,
      label: 'Custom',
      hint: 'Only transactions between two dates count, e.g. a holiday or a season.',
    },
  ];

  readonly form = this.fb.group(
    {
      name: ['', [Validators.required, NOT_BLANK, Validators.maxLength(TEXT_LIMITS.budgetName)]],
      description: [
        '',
        [Validators.required, NOT_BLANK, Validators.maxLength(TEXT_LIMITS.budgetDescription)],
      ],
      amount: [0, [Validators.required, Validators.min(0.01), Validators.max(MAX_AMOUNT), cents]],
      status: [Status.Active, Validators.required],
      period: [BudgetPeriod.Total, Validators.required],
      startDate: '',
      endDate: '',
      categoryIds: this.fb.control<string[]>([]),
      merchant: ['', Validators.maxLength(TEXT_LIMITS.budgetMerchant)],
    },
    { validators: CUSTOM_DAYS },
  );

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
  private readonly chosenCategories = toSignal(this.form.controls.categoryIds.valueChanges, {
    initialValue: this.form.controls.categoryIds.value,
  });
  private readonly typedMerchant = toSignal(this.form.controls.merchant.valueChanges, {
    initialValue: this.form.controls.merchant.value,
  });
  /** A budget counts categories or a merchant, not both: whichever is used locks the other. */
  readonly categoriesLocked = computed(() => this.typedMerchant().trim() !== '');
  readonly merchantLocked = computed(() => this.chosenCategories().length > 0);

  ngOnInit(): void {
    const budget = this.budget();
    if (budget) {
      this.form.setValue({
        name: budget.name,
        description: budget.description,
        amount: budget.totalAmount,
        status: budget.status,
        period: budget.period,
        startDate: day(budget.startDate),
        endDate: day(budget.endDate),
        categoryIds: (budget.categories ?? []).map((c) => c.id),
        merchant: budget.merchant ?? '',
      });
    }
    // A total budget has no period's spending to count by itself, and only a custom one has days.
    this.form.controls.period.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((period) => {
        if (period === BudgetPeriod.Total) {
          this.form.controls.categoryIds.setValue([]);
          this.form.controls.merchant.setValue('');
        }
        if (period !== BudgetPeriod.Custom) {
          this.form.controls.startDate.setValue('');
          this.form.controls.endDate.setValue('');
        }
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
  protected readonly maxAmount = MAX_AMOUNT;

  isInvalid(control: 'name' | 'description' | 'amount' | 'merchant'): boolean {
    const c = this.form.controls[control];
    return c.invalid && c.touched;
  }

  /** The custom days are wrong and the person has been to them. */
  daysInvalid(): boolean {
    const { startDate, endDate } = this.form.controls;
    if (this.form.hasError('daysYear')) {
      // Not while the year is being typed, but once the field with it is left: the Create button stays disabled
      // meanwhile, so waiting for a submit would never say why.
      const short = (control: typeof startDate) => yearStillTyped(control.value) && control.touched;
      return this.submitted() || short(startDate) || short(endDate);
    }
    return this.form.hasError('daysMissing') || this.form.hasError('daysOrder')
      ? startDate.touched || endDate.touched
      : false;
  }

  onSubmit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.submitted.set(true);
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
      startDate: value.period === BudgetPeriod.Custom ? value.startDate : undefined,
      endDate: value.period === BudgetPeriod.Custom ? value.endDate : undefined,
      categoryIds: value.categoryIds,
      merchant: value.merchant.trim() || undefined,
    });
  }
}
