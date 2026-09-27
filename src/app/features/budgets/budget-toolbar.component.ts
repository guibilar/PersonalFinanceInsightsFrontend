import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Status } from '../../core/models/enums/status';
import { IconComponent } from '../../shared/ui/icon/icon.component';

export interface BudgetCriteria {
  name?: string;
  status?: Status;
}

export const BUDGET_SEARCH_DEBOUNCE_MS = 300;

/** Name search (debounced) and an All / Active / Inactive switch; both apply immediately. */
@Component({
  selector: 'app-budget-toolbar',
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <div class="card mb-3">
      <div class="card-body d-flex flex-wrap align-items-center gap-2 py-3">
        <div class="flex-grow-1" style="min-width: 14rem">
          <label for="budget-search" class="visually-hidden">Search budgets</label>
          <div class="input-group">
            <span class="input-group-text bg-transparent text-body-secondary"
              ><app-icon name="search" [size]="16"
            /></span>
            <input
              type="search"
              id="budget-search"
              class="form-control border-start-0"
              placeholder="Search budgets"
              autocomplete="off"
              [formControl]="search"
            />
          </div>
        </div>
        <div class="btn-group" role="group" aria-label="Status">
          @for (option of statusOptions; track option.label) {
            <button
              type="button"
              class="btn btn-outline-secondary"
              [class.active]="criteria().status === option.value"
              [attr.aria-pressed]="criteria().status === option.value"
              (click)="setStatus(option.value)"
            >
              {{ option.label }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetToolbarComponent {
  readonly criteria = input.required<BudgetCriteria>();
  readonly criteriaChange = output<BudgetCriteria>();

  readonly search = new FormControl('', { nonNullable: true });
  readonly statusOptions: { value: Status | undefined; label: string }[] = [
    { value: undefined, label: 'All' },
    { value: Status.Active, label: 'Active' },
    { value: Status.Inactive, label: 'Inactive' },
  ];

  constructor() {
    effect(() => this.search.setValue(this.criteria().name ?? '', { emitEvent: false }));

    this.search.valueChanges
      .pipe(
        debounceTime(BUDGET_SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((name) =>
        this.criteriaChange.emit({ ...this.criteria(), name: name.trim() || undefined }),
      );
  }

  setStatus(status: Status | undefined): void {
    this.criteriaChange.emit({ ...this.criteria(), status });
  }
}
