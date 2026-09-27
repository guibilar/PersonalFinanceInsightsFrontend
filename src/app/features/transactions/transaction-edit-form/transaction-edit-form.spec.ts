import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionEditForm } from './transaction-edit-form';
import { TransactionUpdateInputDto } from '../../../core/models/inputs/transaction-update-input-dto';
import { AccountType } from '../../../core/models/enums/account-type';
import { Category } from '../../../core/models/enums/category';

describe('TransactionEditForm', () => {
  let fixture: ComponentFixture<TransactionEditForm>;
  let component: TransactionEditForm;
  let submitted: TransactionUpdateInputDto[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TransactionEditForm],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(TransactionEditForm);
    fixture.componentRef.setInput('transaction', {
      id: 't1',
      date: '2026-09-10',
      amount: 12,
      description: 'SQ *CORNER STORE',
      category: Category.Other,
      categoryLocked: false,
      account: AccountType.CreditCard,
      budgetId: '',
    });
    component = fixture.componentInstance;
    submitted = [];
    component.submitUpdate.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
  });

  it('prefills the current description and category', () => {
    expect(component.form.getRawValue()).toEqual({
      description: 'SQ *CORNER STORE',
      category: Category.Other,
    });
  });

  it('emits the trimmed description and chosen category', () => {
    component.form.setValue({ description: '  Corner store  ', category: Category.Groceries });

    component.onSubmit();

    expect(submitted).toEqual([{ description: 'Corner store', category: Category.Groceries }]);
  });

  it('does not submit a blank description', () => {
    component.form.controls.description.setValue('   ');

    component.onSubmit();

    expect(submitted).toEqual([]);
    expect(component.form.controls.description.touched).toBe(true);
  });

  it('disables Save while saving', () => {
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    const save: HTMLButtonElement = fixture.nativeElement.querySelector('button[type=submit]');
    expect(save.disabled).toBe(true);
    expect(save.textContent).toContain('Saving');
  });
});
