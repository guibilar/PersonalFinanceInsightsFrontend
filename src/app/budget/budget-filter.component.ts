import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BudgetFilterInputDto } from '../../Models/Inputs/budget-filter-input-dto';
import { Status } from '../../Models/Enums/status';

@Component({
  selector: 'app-budget-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './budget-filter.component.html',
  styleUrls: ['./budget-filter.component.css']
})
export class BudgetFilterComponent {
  @Input() filter: BudgetFilterInputDto = {
    Page: 1,
    PageSize: 10
  };

  @Output() filterChange = new EventEmitter<BudgetFilterInputDto>();

  statusOptions = [
    { value: undefined, label: 'All' },
    { value: Status.Active, label: 'Active' },
    { value: Status.Inactive, label: 'Inactive' }
  ];

  applyFilter(): void {
    this.filterChange.emit(this.filter);
  }

  clearFilter(): void {
    const newFilter: BudgetFilterInputDto = {
      Page: this.filter.Page,
      PageSize: this.filter.PageSize
    };

    this.filter = newFilter;
    this.filterChange.emit(this.filter);
  }
}
