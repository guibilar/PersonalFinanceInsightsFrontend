import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TransactionLinkForm } from './transaction-link-form';
import { TransactionLinkingInputDto } from '../../../core/models/inputs/transaction-linking-input-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { AccountType } from '../../../core/models/enums/account-type';
import { Category } from '../../../core/models/enums/category';
import { Flow } from '../../../core/models/enums/flow';

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

function transaction(budgetId: string): TransactionOutputDto {
  return {
    id: 't1',
    date: '2026-09-10',
    amount: 10,
    description: 'Coffee',
    category: Category.Dining,
    categoryLocked: false,
    accountId: 'a2',
    accountName: 'Visa',
    accountType: AccountType.CreditCard,
    flow: Flow.Spending,
    flowLocked: false,
    budgetId,
  };
}

describe('TransactionLinkForm', () => {
  function create(budgetId: string) {
    TestBed.configureTestingModule({
      imports: [TransactionLinkForm],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(TransactionLinkForm);
    fixture.componentRef.setInput('transaction', transaction(budgetId));
    const submitted: TransactionLinkingInputDto[] = [];
    fixture.componentInstance.submitTransaction.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
    return { component: fixture.componentInstance, submitted };
  }

  it('treats an empty GUID as no budget selected', () => {
    const { component, submitted } = create(EMPTY_GUID);

    component.onSubmit();

    expect(component.form.controls.budgetId.value).toBe('');
    expect(component.form.invalid).toBe(true);
    expect(submitted).toEqual([]);
  });

  it('emits the selected budget for the transaction', () => {
    const { component, submitted } = create(EMPTY_GUID);

    component.form.setValue({ budgetId: 'b2' });
    component.onSubmit();

    expect(submitted).toEqual([{ transactionId: 't1', budgetId: 'b2' }]);
  });

  it('preselects an existing budget', () => {
    const { component } = create('b1');

    expect(component.form.controls.budgetId.value).toBe('b1');
  });
});
