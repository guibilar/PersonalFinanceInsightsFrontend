import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionAddForm } from './transaction-add-form';
import { AccountType } from '../../../core/models/enums/account-type';
import { TEST_CATEGORIES } from '../../../testing/test-categories';
import { Flow } from '../../../core/models/enums/flow';
import { StatementFormat } from '../../../core/models/enums/statement-format';
import { TransactionType } from '../../../core/models/enums/transaction-type';
import { TransactionInputDto } from '../../../core/models/inputs/transaction-input-dto';
import { AccountOutputDto } from '../../../core/models/outputs/account-output-dto';

const accounts: AccountOutputDto[] = [
  {
    id: 'a1',
    name: 'Visa',
    type: AccountType.CreditCard,
    format: StatementFormat.Cibc,
    transactionCount: 3,
  },
  {
    id: 'a2',
    name: 'Neo chequing',
    type: AccountType.Chequing,
    format: StatementFormat.Manual,
    transactionCount: 0,
  },
];

describe('TransactionAddForm', () => {
  let fixture: ComponentFixture<TransactionAddForm>;
  let component: TransactionAddForm;
  let submitted: TransactionInputDto[];

  const root = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TransactionAddForm],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(TransactionAddForm);
    fixture.componentRef.setInput('accounts', accounts);
    component = fixture.componentInstance;
    submitted = [];
    component.submitAdd.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('starts on an account without statement files, with today as the date', () => {
    expect(component.form.controls.accountId.value).toBe('a2');
    expect(component.form.controls.date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('starts on the date and account of the previous transaction', async () => {
    const again = TestBed.createComponent(TransactionAddForm);
    again.componentRef.setInput('accounts', accounts);
    again.componentRef.setInput('previous', { date: '2026-08-14', accountId: 'a1' });
    again.detectChanges();
    await again.whenStable();

    expect(again.componentInstance.form.controls.date.value).toBe('2026-08-14');
    expect(again.componentInstance.form.controls.accountId.value).toBe('a1');
  });

  it('adds money out, leaving the category and flow to the rules', () => {
    component.form.patchValue({ date: '2026-09-10', description: '  Coffee ', amount: 4.5 });

    component.onSubmit();

    expect(submitted).toEqual([
      {
        date: '2026-09-10',
        description: 'Coffee',
        amount: 4.5,
        transactionType: TransactionType.Debit,
        accountId: 'a2',
      },
    ]);
  });

  it('sends a picked category and flow, and only flows that fit the direction', () => {
    component.form.patchValue({
      description: 'Refund',
      amount: 10,
      transactionType: TransactionType.Credit,
    });
    expect(component.flows()).toEqual([Flow.Refund, Flow.Income, Flow.Transfer, Flow.Ignored]);
    component.form.patchValue({ categoryId: TEST_CATEGORIES.dining.id, flow: Flow.Refund });

    component.onSubmit();

    expect(submitted[0]).toEqual(
      expect.objectContaining({
        transactionType: TransactionType.Credit,
        categoryId: TEST_CATEGORIES.dining.id,
        flow: Flow.Refund,
      }),
    );
  });

  it('drops a flow that no longer fits when the direction changes', () => {
    component.form.patchValue({
      transactionType: TransactionType.Credit,
      flow: Flow.Income,
    });

    component.form.controls.transactionType.setValue(TransactionType.Debit);

    expect(component.form.controls.flow.value).toBeNull();
  });

  it('needs a description and an amount above zero', async () => {
    component.form.patchValue({ description: '  ', amount: 0 });
    component.onSubmit();
    await fixture.whenStable();

    expect(submitted).toEqual([]);
    expect(root().textContent).toContain('Description is required.');
    expect(root().textContent).toContain('Enter an amount above zero.');
  });

  it('takes whole cents only, as the API does', async () => {
    component.form.patchValue({ description: 'Coffee', amount: 4.555 });
    component.form.markAllAsTouched();
    await fixture.whenStable();

    expect(component.form.controls.amount.hasError('cents')).toBe(true);
    expect(root().textContent).toContain('Use whole cents: at most 2 decimal places.');

    component.form.patchValue({ amount: 4.55 });
    expect(component.form.controls.amount.valid).toBe(true);
  });

  it('offers to add a duplicate anyway', async () => {
    component.form.patchValue({ description: 'Coffee', amount: 4.5 });
    fixture.componentRef.setInput('duplicate', 'An identical transaction already exists.');
    await fixture.whenStable();

    const button = Array.from(root().querySelectorAll('button')).find((b) =>
      b.textContent!.includes('Add it anyway'),
    )!;
    button.click();

    expect(root().textContent).toContain('An identical transaction already exists.');
    expect(submitted).toEqual([
      expect.objectContaining({ description: 'Coffee', allowDuplicate: true }),
    ]);
  });
});
