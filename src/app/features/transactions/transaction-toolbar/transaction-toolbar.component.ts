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
import { TransactionFilterInputDto } from '../../../core/models/inputs/transaction-filter-input-dto';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/** The criteria this toolbar controls; paging and sorting stay with the page. */
export type TransactionCriteria = Pick<
  TransactionFilterInputDto,
  'description' | 'category' | 'startDate' | 'endDate'
>;

type CriteriaKey = keyof TransactionCriteria;

interface Chip {
  key: CriteriaKey;
  label: string;
}

export const SEARCH_DEBOUNCE_MS = 300;

/** Search, category and date filters that apply as you type, with removable chips for active filters. */
@Component({
  selector: 'app-transaction-toolbar',
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './transaction-toolbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionToolbarComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly filter = input.required<TransactionFilterInputDto>();
  readonly criteriaChange = output<TransactionCriteria>();

  readonly categories = Object.values(Category);

  readonly form = this.fb.group({
    description: '',
    category: this.fb.control<Category | null>(null),
    startDate: '',
    endDate: '',
  });

  readonly chips = computed<Chip[]>(() => {
    const filter = this.filter();
    const chips: Chip[] = [];
    if (filter.description) chips.push({ key: 'description', label: `“${filter.description}”` });
    if (filter.category) chips.push({ key: 'category', label: filter.category });
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
      startDate: value.startDate || undefined,
      endDate: value.endDate || undefined,
    };
  }
}
