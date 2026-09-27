import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BudgetFilterInputDto } from '../../core/models/inputs/budget-filter-input-dto';
import { Status } from '../../core/models/enums/status';

@Component({
  selector: 'app-budget-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './budget-filter.component.html',
  styleUrls: ['./budget-filter.component.css']
})
export class BudgetFilterComponent {
  // Edited locally; the parent only sees changes on apply/clear.
  filter: BudgetFilterInputDto = {
    page: 1,
    pageSize: 10
  };

  @Input('filter') set filterInput(value: BudgetFilterInputDto) {
    this.filter = { ...value };
  }

  @Output() filterChange = new EventEmitter<BudgetFilterInputDto>();

  statusOptions = [
    { value: undefined, label: 'All' },
    { value: Status.Active, label: 'Active' },
    { value: Status.Inactive, label: 'Inactive' }
  ];

  applyFilter(): void {
    this.filterChange.emit({ ...this.filter });
  }

  clearFilter(): void {
    const newFilter: BudgetFilterInputDto = {
      page: this.filter.page,
      pageSize: this.filter.pageSize
    };

    this.filter = newFilter;
    this.filterChange.emit(this.filter);
  }
}
