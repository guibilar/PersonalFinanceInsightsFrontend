import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TransactionFilterInputDto } from '../../../core/models/inputs/transaction-filter-input-dto';
import { TransactionType } from '../../../core/models/enums/transaction-type';
import { AccountType } from '../../../core/models/enums/account-type';
import { Category } from '../../../core/models/enums/category';
import { PAGE_SIZE_OPTIONS } from '../../../shared/utils/page-size-options';
import { FilterPanelComponent } from '../../../shared/ui/filter-panel/filter-panel.component';

export type FilterField =
  | 'description'
  | 'transactionType'
  | 'category'
  | 'accountTypes'
  | 'startDate'
  | 'endDate'
  | 'transactionId'
  | 'budgetId'
  | 'pageSize';

@Component({
  selector: 'app-transaction-filter',
  imports: [FilterPanelComponent, ReactiveFormsModule],
  templateUrl: './transaction-filter.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionFilterComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly filter = input.required<TransactionFilterInputDto>();
  readonly enabledFilters = input<FilterField[]>([]);
  readonly filterChange = output<TransactionFilterInputDto>();

  readonly transactionTypes = Object.values(TransactionType);
  readonly accountTypes = Object.values(AccountType);
  readonly categories = Object.values(Category);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  // Edited locally; the parent only sees changes on apply/clear.
  readonly form = this.fb.group({
    transactionId: '',
    description: '',
    transactionType: this.fb.control<TransactionType | null>(null),
    accountType: this.fb.control<AccountType[]>([]),
    category: this.fb.control<Category | null>(null),
    startDate: '',
    endDate: '',
    budgetId: '',
    pageSize: 10,
  });

  constructor() {
    effect(() => {
      const filter = this.filter();
      this.form.reset({
        transactionId: filter.transactionId ?? '',
        description: filter.description ?? '',
        transactionType: filter.transactionType ?? null,
        accountType: filter.accountType ?? [],
        category: filter.category ?? null,
        startDate: filter.startDate ?? '',
        endDate: filter.endDate ?? '',
        budgetId: filter.budgetId ?? '',
        pageSize: filter.pageSize,
      });
    });
  }

  isFilterEnabled(filterName: FilterField): boolean {
    return this.enabledFilters().includes(filterName);
  }

  isAccountTypeSelected(accountType: AccountType): boolean {
    return this.form.controls.accountType.value.includes(accountType);
  }

  onAccountTypeChange(accountType: AccountType, checked: boolean): void {
    const control = this.form.controls.accountType;
    const others = control.value.filter((type) => type !== accountType);
    control.setValue(checked ? [...others, accountType] : others);
  }

  applyFilter(): void {
    const value = this.form.getRawValue();
    this.filterChange.emit({
      transactionId: value.transactionId.trim() || undefined,
      description: value.description.trim() || undefined,
      transactionType: value.transactionType ?? undefined,
      accountType: value.accountType.length > 0 ? value.accountType : undefined,
      category: value.category ?? undefined,
      startDate: value.startDate || undefined,
      endDate: value.endDate || undefined,
      budgetId: value.budgetId.trim() || undefined,
      page: this.filter().page,
      pageSize: value.pageSize,
    });
  }

  // Resets only the fields shown to the user; hidden ones keep the parent's values.
  clearFilter(): void {
    const controls = this.form.controls;
    const clearable: [FilterField, () => void][] = [
      ['transactionId', () => controls.transactionId.reset()],
      ['description', () => controls.description.reset()],
      ['transactionType', () => controls.transactionType.reset()],
      ['accountTypes', () => controls.accountType.reset()],
      ['category', () => controls.category.reset()],
      ['startDate', () => controls.startDate.reset()],
      ['endDate', () => controls.endDate.reset()],
      ['budgetId', () => controls.budgetId.reset()],
    ];
    clearable.filter(([field]) => this.isFilterEnabled(field)).forEach(([, reset]) => reset());

    this.applyFilter();
  }
}
