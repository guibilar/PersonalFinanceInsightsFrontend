import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { BudgetFilterInputDto } from '../../core/models/inputs/budget-filter-input-dto';
import { Status } from '../../core/models/enums/status';
import { PAGE_SIZE_OPTIONS } from '../../shared/utils/page-size-options';

@Component({
  selector: 'app-budget-filter',
  imports: [ReactiveFormsModule],
  templateUrl: './budget-filter.component.html',
  styleUrls: ['./budget-filter.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BudgetFilterComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly filter = input.required<BudgetFilterInputDto>();
  readonly filterChange = output<BudgetFilterInputDto>();

  readonly statusOptions = [
    { value: null, label: 'All' },
    { value: Status.Active, label: 'Active' },
    { value: Status.Inactive, label: 'Inactive' }
  ];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  // Edited locally; the parent only sees changes on apply/clear.
  readonly form = this.fb.group({
    name: '',
    description: '',
    status: this.fb.control<Status | null>(null),
    pageSize: 10
  });

  constructor() {
    effect(() => {
      const filter = this.filter();
      this.form.reset({
        name: filter.name ?? '',
        description: filter.description ?? '',
        status: filter.status ?? null,
        pageSize: filter.pageSize
      });
    });
  }

  applyFilter(): void {
    const { name, description, status, pageSize } = this.form.getRawValue();
    this.filterChange.emit({
      name: name.trim() || undefined,
      description: description.trim() || undefined,
      status: status ?? undefined,
      page: this.filter().page,
      pageSize
    });
  }

  clearFilter(): void {
    this.form.reset({ pageSize: this.form.controls.pageSize.value });
    this.applyFilter();
  }
}
