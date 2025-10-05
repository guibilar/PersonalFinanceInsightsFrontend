import {Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TransactionFilterInputDto} from '../../Models/Inputs/transaction-filter-input-dto';
import {TransactionType} from '../../Models/Enums/transaction-type';
import {AccountType} from '../../Models/Enums/account-type';
import {Category} from '../../Models/Enums/category';

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
export class TransactionFilterComponent {
  @Input() filter: TransactionFilterInputDto = {
    Page: 1,
    PageSize: 10
  };
  @Input() enabledFilters: FilterField[] = [];

  @Output() filterChange = new EventEmitter<TransactionFilterInputDto>();

  isFilterEnabled(filterName: FilterField): boolean {
    return this.enabledFilters.includes(filterName);
  }

  transactionTypes = Object.keys(TransactionType).filter(key => isNaN(Number(key)));
  accountTypes = Object.keys(AccountType).filter(key => isNaN(Number(key)));
  categories = Object.keys(Category).filter(key => isNaN(Number(key)));

  selectedAccountTypes: { [key: string]: boolean } = {};

  ngOnInit(): void {
    if (this.filter.AccountType) {
      this.filter.AccountType.forEach(type => {
        const key = AccountType[type];
        this.selectedAccountTypes[key] = true;
      });
    }
  }

  onAccountTypeChange(accountType: string, checked: boolean): void {
    this.selectedAccountTypes[accountType] = checked;

    const selected = Object.keys(this.selectedAccountTypes)
      .filter(key => this.selectedAccountTypes[key])
      .map(key => AccountType[key as keyof typeof AccountType]);

    this.filter.AccountType = selected.length > 0 ? selected : undefined;
  }

  applyFilter(): void {
    this.filterChange.emit(this.filter);
  }

  clearFilter(): void {
    const newFilter: TransactionFilterInputDto = {
      Page: this.filter.Page,
      PageSize: this.filter.PageSize
    };

    // Only clear fields that are not enabled
    if (!this.isFilterEnabled('description')) {
      newFilter.Description = this.filter.Description;
    }
    if (!this.isFilterEnabled('transactionType')) {
      newFilter.TransactionType = this.filter.TransactionType;
    }
    if (!this.isFilterEnabled('category')) {
      newFilter.Category = this.filter.Category;
    }
    if (!this.isFilterEnabled('accountTypes')) {
      newFilter.AccountType = this.filter.AccountType;
    } else {
      this.selectedAccountTypes = {};
    }
    if (!this.isFilterEnabled('startDate')) {
      newFilter.StartDate = this.filter.StartDate;
    }
    if (!this.isFilterEnabled('endDate')) {
      newFilter.EndDate = this.filter.EndDate;
    }
    if (!this.isFilterEnabled('transactionId')) {
      newFilter.TransactionId = this.filter.TransactionId;
    }
    if (!this.isFilterEnabled('budgetId')) {
      newFilter.BudgetId = this.filter.BudgetId;
    }

    this.filter = newFilter;
    this.filterChange.emit(this.filter);
  }
}
