import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, filter, merge } from 'rxjs';
import { Category } from '../../../core/models/enums/category';
import { Flow } from '../../../core/models/enums/flow';
import { TransactionFilterInputDto } from '../../../core/models/inputs/transaction-filter-input-dto';
import { AccountOutputDto } from '../../../core/models/outputs/account-output-dto';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { FLOW_LABELS } from '../../../shared/utils/flow-helper';

/** The criteria this toolbar controls; paging and sorting stay with the page. */
export type TransactionCriteria = Pick<
  TransactionFilterInputDto,
  'description' | 'category' | 'accountId' | 'flow' | 'startDate' | 'endDate'
>;

type CriteriaKey = keyof TransactionCriteria;

interface Chip {
  key: CriteriaKey;
  label: string;
}

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Search, category, account, flow and date filters that apply as you type, with removable chips for active
 * filters.
 */
@Component({
  selector: 'app-transaction-toolbar',
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './transaction-toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionToolbarComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly filter = input.required<TransactionFilterInputDto>();
  /** For the account filter; the page loads them. */
  readonly accounts = input<AccountOutputDto[]>([]);
  readonly criteriaChange = output<TransactionCriteria>();

  readonly categories = Object.values(Category);
  readonly flows = Object.values(Flow);
  readonly flowLabels = FLOW_LABELS;

  readonly form = this.fb.group({
    description: '',
    category: this.fb.control<Category | null>(null),
    accountId: this.fb.control<string | null>(null),
    flow: this.fb.control<Flow | null>(null),
    startDate: '',
    endDate: '',
  });

  readonly chips = computed<Chip[]>(() => {
    const filter = this.filter();
    const chips: Chip[] = [];
    if (filter.description) chips.push({ key: 'description', label: `“${filter.description}”` });
    if (filter.category) chips.push({ key: 'category', label: filter.category });
    if (filter.accountId) {
      const account = this.accounts().find((a) => a.id === filter.accountId);
      chips.push({ key: 'accountId', label: account?.name ?? 'Account' });
    }
    if (filter.flow) chips.push({ key: 'flow', label: FLOW_LABELS[filter.flow] });
    if (filter.startDate) chips.push({ key: 'startDate', label: `From ${filter.startDate}` });
    if (filter.endDate) chips.push({ key: 'endDate', label: `To ${filter.endDate}` });
    return chips;
  });

  constructor() {
    // Keep the fields in sync with the applied filter (e.g. after a chip is removed).
    effect(() => {
      const filter = this.filter();
      this.form.setValue(
        {
          description: filter.description ?? '',
          category: filter.category ?? null,
          accountId: filter.accountId ?? null,
          flow: filter.flow ?? null,
          startDate: filter.startDate ?? '',
          endDate: filter.endDate ?? '',
        },
        { emitEvent: false },
      );
    });

    const controls = this.form.controls;
    merge(
      controls.description.valueChanges.pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        // Compare with the applied search, not the last typed one: after a chip or "Clear all"
        // resets the field, typing the same words again must search again.
        filter((value) => (value.trim() || undefined) !== this.filter().description),
      ),
      controls.category.valueChanges,
      controls.accountId.valueChanges,
      controls.flow.valueChanges,
      controls.startDate.valueChanges,
      controls.endDate.valueChanges,
    )
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.criteriaChange.emit(this.criteria()));
  }

  remove(key: CriteriaKey): void {
    this.criteriaChange.emit({ ...this.criteria(), [key]: undefined });
  }

  clearAll(): void {
    this.criteriaChange.emit({});
  }

  private criteria(): TransactionCriteria {
    const value = this.form.getRawValue();
    return {
      description: value.description.trim() || undefined,
      category: value.category ?? undefined,
      accountId: value.accountId ?? undefined,
      flow: value.flow ?? undefined,
      startDate: value.startDate || undefined,
      endDate: value.endDate || undefined,
    };
  }
}
