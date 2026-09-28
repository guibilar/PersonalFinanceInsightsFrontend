import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BankAccountFormComponent } from './bank-account-form.component';
import { AccountType } from '../../core/models/enums/account-type';
import { AccountInputDto } from '../../core/models/inputs/account-input-dto';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';

describe('BankAccountFormComponent', () => {
  let fixture: ComponentFixture<BankAccountFormComponent>;
  let component: BankAccountFormComponent;
  let submitted: AccountInputDto[];

  function create(account: AccountOutputDto | null) {
    TestBed.configureTestingModule({
      imports: [BankAccountFormComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(BankAccountFormComponent);
    fixture.componentRef.setInput('account', account);
    component = fixture.componentInstance;
    submitted = [];
    component.submitAccount.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
  }

  it('adds an account with a trimmed name and its type', () => {
    create(null);
    component.form.patchValue({ name: '  Visa ', type: AccountType.CreditCard });

    component.onSubmit();

    expect(submitted).toEqual([{ name: 'Visa', type: AccountType.CreditCard }]);
  });

  it('lists the types by their labels', () => {
    create(null);

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('#account-type option'),
    ).map((o) => o.textContent?.trim());
    expect(options).toEqual(['Chequing', 'Savings', 'Credit card']);
  });

  it('renames without changing the type', () => {
    create({ id: 'a1', name: 'Visa', type: AccountType.CreditCard, transactionCount: 3 });
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#account-type',
    )!;

    expect(select.disabled).toBe(true);
    component.form.controls.name.setValue('Visa Infinite');
    component.onSubmit();

    expect(submitted).toEqual([{ name: 'Visa Infinite', type: AccountType.CreditCard }]);
  });

  it('needs a name of at most 100 characters', async () => {
    create(null);
    component.form.controls.name.setValue('  ');
    component.onSubmit();
    component.form.controls.name.setValue('x'.repeat(101));
    component.onSubmit();
    await fixture.whenStable();

    expect(submitted).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('At most 100 characters.');
  });
});
