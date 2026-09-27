import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TransactionFilterInputDto} from '../../../core/models/inputs/transaction-filter-input-dto';
import {TransactionType} from '../../../core/models/enums/transaction-type';
import {AccountType} from '../../../core/models/enums/account-type';
import {Category} from '../../../core/models/enums/category';

export type FilterField =
  'description'
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
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transaction-filter.component.html',
  styleUrls: ['./transaction-filter.component.css']
})
export class TransactionFilterComponent implements OnInit {
  // Edited locally; the parent only sees changes on apply/clear.
  filter: TransactionFilterInputDto = {
    page: 1,
    pageSize: 10
  };

  @Input('filter') set filterInput(value: TransactionFilterInputDto) {
    this.filter = { ...value, accountType: value.accountType ? [...value.accountType] : undefined };
  }
  @Input() enabledFilters: FilterField[] = [];

  @Output() filterChange = new EventEmitter<TransactionFilterInputDto>();

  isFilterEnabled(filterName: FilterField): boolean {
    return this.enabledFilters.includes(filterName);
  }

  readonly transactionTypes = Object.values(TransactionType);
  readonly accountTypes = Object.values(AccountType);
  readonly categories = Object.values(Category);

  selectedAccountTypes: Partial<Record<AccountType, boolean>> = {};

  ngOnInit(): void {
    this.filter.accountType?.forEach(type => (this.selectedAccountTypes[type] = true));
  }

  onAccountTypeChange(accountType: AccountType, checked: boolean): void {
    this.selectedAccountTypes[accountType] = checked;

    const selected = this.accountTypes.filter(type => this.selectedAccountTypes[type]);

    this.filter.accountType = selected.length > 0 ? selected : undefined;
  }

  applyFilter(): void {
    this.filterChange.emit({ ...this.filter });
  }

  clearFilter(): void {
    const newFilter: TransactionFilterInputDto = {
      page: this.filter.page,
      pageSize: this.filter.pageSize
    };

    // Only clear fields that are not enabled
    if (!this.isFilterEnabled('description')) {
      newFilter.description = this.filter.description;
    }
    if (!this.isFilterEnabled('transactionType')) {
      newFilter.transactionType = this.filter.transactionType;
    }
    if (!this.isFilterEnabled('category')) {
      newFilter.category = this.filter.category;
    }
    if (!this.isFilterEnabled('accountTypes')) {
      newFilter.accountType = this.filter.accountType;
    } else {
      this.selectedAccountTypes = {};
    }
    if (!this.isFilterEnabled('startDate')) {
      newFilter.startDate = this.filter.startDate;
    }
    if (!this.isFilterEnabled('endDate')) {
      newFilter.endDate = this.filter.endDate;
    }
    if (!this.isFilterEnabled('transactionId')) {
      newFilter.transactionId = this.filter.transactionId;
    }
    if (!this.isFilterEnabled('budgetId')) {
      newFilter.budgetId = this.filter.budgetId;
    }

    this.filter = newFilter;
    this.filterChange.emit(this.filter);
  }
}
