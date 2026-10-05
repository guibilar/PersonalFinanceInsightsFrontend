import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BankAccountFormComponent } from './bank-account-form.component';
import { AccountType } from '../../core/models/enums/account-type';
import { RegisteredPlan } from '../../core/models/enums/registered-plan';
import { StatementFormat } from '../../core/models/enums/statement-format';
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

    // CIBC unless another format is chosen: the first bank the app read.
    expect(submitted).toEqual([
      { name: 'Visa', type: AccountType.CreditCard, format: StatementFormat.Cibc },
    ]);
  });

  it('adds an account with the chosen statement format', () => {
    create(null);
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#account-format',
    )!;
    const options = Array.from(select.options).map((o) => o.textContent?.trim());
    component.form.patchValue({ name: 'Neo card', type: AccountType.CreditCard });
    component.form.controls.format.setValue(StatementFormat.Neo);

    component.onSubmit();

    expect(options).toEqual(['CIBC', 'Neo Financial', 'Wealthsimple', 'No files (add by hand)']);
    expect(submitted).toEqual([
      { name: 'Neo card', type: AccountType.CreditCard, format: StatementFormat.Neo },
    ]);
  });

  it('lists the types by their labels', () => {
    create(null);

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('#account-type option'),
    ).map((o) => o.textContent?.trim());
    expect(options).toEqual(['Chequing', 'Savings', 'Credit card', 'Investment']);
  });

  it('edits the name and format without changing the type', () => {
    create({
      id: 'a1',
      name: 'Visa',
      type: AccountType.CreditCard,
      format: StatementFormat.Cibc,
      transactionCount: 3,
    });
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#account-type',
    )!;

    const format = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#account-format',
    )!;

    expect(select.disabled).toBe(true);
    expect(format.disabled).toBe(false);
    component.form.controls.name.setValue('Visa Infinite');
    component.form.controls.format.setValue(StatementFormat.Neo);
    component.onSubmit();

    expect(submitted).toEqual([
      { name: 'Visa Infinite', type: AccountType.CreditCard, format: StatementFormat.Neo },
    ]);
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

  describe('registered plans', () => {
    const root = () => fixture.nativeElement as HTMLElement;

    it('are offered for savings and investments only, with room once a plan is chosen', async () => {
      create(null);
      expect(root().querySelector('#account-plan')).toBeNull();

      component.form.controls.type.setValue(AccountType.Investment);
      await fixture.whenStable();
      expect(root().querySelector('#account-plan')).not.toBeNull();
      expect(root().querySelector('#account-room')).toBeNull();

      component.form.controls.plan.setValue(RegisteredPlan.Tfsa);
      await fixture.whenStable();
      expect(root().querySelector('#account-room')).not.toBeNull();
    });

    it('sends the plan and its room, and only a plan for an account held in one', () => {
      create(null);
      component.form.patchValue({
        name: 'Wealthsimple TFSA',
        type: AccountType.Investment,
        plan: RegisteredPlan.Tfsa,
        contributionRoom: 7000,
      });
      component.onSubmit();
      component.form.patchValue({ name: 'Chequing', type: AccountType.Chequing });
      component.onSubmit();

      expect(submitted).toEqual([
        {
          name: 'Wealthsimple TFSA',
          type: AccountType.Investment,
          format: StatementFormat.Cibc,
          plan: RegisteredPlan.Tfsa,
          contributionRoom: 7000,
          contributionRoomYear: new Date().getFullYear(),
        },
        { name: 'Chequing', type: AccountType.Chequing, format: StatementFormat.Cibc },
      ]);
    });

    it("starts from the account's plan and room when editing", () => {
      create({
        id: 'a9',
        name: 'TFSA',
        type: AccountType.Investment,
        format: StatementFormat.Manual,
        transactionCount: 3,
        plan: RegisteredPlan.Tfsa,
        contributionRoom: 6500,
        contributionRoomYear: 2025,
      });

      expect(component.form.getRawValue()).toEqual(
        expect.objectContaining({
          plan: RegisteredPlan.Tfsa,
          contributionRoom: 6500,
          contributionRoomYear: 2025,
        }),
      );
      expect(component.canHavePlan()).toBe(true);
    });
  });
});
