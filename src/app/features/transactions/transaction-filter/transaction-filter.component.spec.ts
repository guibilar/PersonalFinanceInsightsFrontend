import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterField, TransactionFilterComponent } from './transaction-filter.component';
import { TransactionFilterInputDto } from '../../../core/models/inputs/transaction-filter-input-dto';
import { AccountType } from '../../../core/models/enums/account-type';
import { Category } from '../../../core/models/enums/category';

describe('TransactionFilterComponent', () => {
  let fixture: ComponentFixture<TransactionFilterComponent>;
  let component: TransactionFilterComponent;
  let emitted: TransactionFilterInputDto[];

  function create(filter: TransactionFilterInputDto, enabledFilters: FilterField[]) {
    TestBed.configureTestingModule({
      imports: [TransactionFilterComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(TransactionFilterComponent);
    fixture.componentRef.setInput('filter', filter);
    fixture.componentRef.setInput('enabledFilters', enabledFilters);
    component = fixture.componentInstance;
    emitted = [];
    component.filterChange.subscribe((value) => emitted.push(value));
    fixture.detectChanges();
  }

  it('only renders enabled fields', () => {
    create({ page: 1, pageSize: 10 }, ['description', 'category']);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('#tx-filter-description')).not.toBeNull();
    expect(element.querySelector('#tx-filter-start')).toBeNull();
  });

  it('emits trimmed values and omits empty fields', () => {
    create({ page: 3, pageSize: 10 }, ['description', 'category', 'accountTypes']);

    component.form.patchValue({ description: '  coffee ', category: Category.Dining });
    component.onAccountTypeChange(AccountType.Savings, true);
    component.applyFilter();

    expect(emitted).toEqual([
      jasmine.objectContaining({
        description: 'coffee',
        category: Category.Dining,
        accountType: [AccountType.Savings],
        startDate: undefined,
        page: 3,
        pageSize: 10,
      }),
    ]);
  });

  it('does not change the parent filter until applied', () => {
    const filter: TransactionFilterInputDto = { description: 'rent', page: 1, pageSize: 10 };
    create(filter, ['description']);

    component.form.patchValue({ description: 'food' });

    expect(filter.description).toBe('rent');
    expect(emitted).toEqual([]);
  });

  it('clears visible fields but keeps hidden ones', () => {
    create({ description: 'rent', budgetId: 'b1', page: 1, pageSize: 25 }, ['description']);

    component.clearFilter();

    expect(emitted[0].description).toBeUndefined();
    expect(emitted[0].budgetId).toBe('b1');
    expect(emitted[0].pageSize).toBe(25);
  });

  it('toggles account types on and off', () => {
    create({ page: 1, pageSize: 10 }, ['accountTypes']);

    component.onAccountTypeChange(AccountType.Chequing, true);
    component.onAccountTypeChange(AccountType.Savings, true);
    component.onAccountTypeChange(AccountType.Chequing, false);

    expect(component.form.controls.accountType.value).toEqual([AccountType.Savings]);
  });
});
