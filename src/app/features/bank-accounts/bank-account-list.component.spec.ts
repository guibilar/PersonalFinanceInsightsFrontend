import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BankAccountListComponent } from './bank-account-list.component';
import { AccountType } from '../../core/models/enums/account-type';
import { RegisteredPlan } from '../../core/models/enums/registered-plan';
import { StatementFormat } from '../../core/models/enums/statement-format';
import { AccountOutputDto } from '../../core/models/outputs/account-output-dto';
import { ToastService } from '../../shared/ui/toast/toast.service';

const accounts: AccountOutputDto[] = [
  {
    id: 'a1',
    name: 'Chequing',
    type: AccountType.Chequing,
    format: StatementFormat.Cibc,
    transactionCount: 120,
  },
  {
    id: 'a2',
    name: 'Visa',
    type: AccountType.CreditCard,
    format: StatementFormat.Cibc,
    transactionCount: 1,
  },
  {
    id: 'a3',
    name: 'Mastercard',
    type: AccountType.CreditCard,
    format: StatementFormat.Cibc,
    transactionCount: 0,
  },
];

describe('BankAccountListComponent', () => {
  let fixture: ComponentFixture<BankAccountListComponent>;
  let component: BankAccountListComponent;
  let http: HttpTestingController;
  let toasts: ToastService;

  const root = () => fixture.nativeElement as HTMLElement;
  const rows = () =>
    Array.from(root().querySelectorAll('.account-row')).map((e) =>
      e.textContent!.replace(/\s+/g, ' ').trim(),
    );
  const messages = () => toasts.toasts().map((t) => t.message);
  const deleteButton = (name: string) =>
    root().querySelector<HTMLButtonElement>(`[aria-label="Delete ${name}"]`)!;

  async function load(list: AccountOutputDto[] = accounts): Promise<void> {
    TestBed.tick();
    http.expectOne({ method: 'GET', url: '/api/Accounts' }).flush(list);
    // Let the load settle: reload() is ignored while a load is still in progress.
    await fixture.whenStable();
  }

  async function reloaded(list: AccountOutputDto[] = accounts): Promise<void> {
    // resource.reload() sends its request asynchronously.
    await new Promise((resolve) => setTimeout(resolve));
    await load(list);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BankAccountListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    fixture = TestBed.createComponent(BankAccountListComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('lists the accounts with their type, statement format and transaction count', async () => {
    await load([accounts[0], { ...accounts[1], format: StatementFormat.Neo }, accounts[2]]);

    expect(rows()).toEqual([
      'Chequing Chequing · CIBC · 120 transactions Add balance',
      'Visa Credit card · Neo Financial · 1 transaction Add balance',
      'Mastercard Credit card · CIBC · 0 transactions Add balance',
    ]);
  });

  it('lets only an account without transactions be deleted', async () => {
    await load();

    expect(deleteButton('Visa').disabled).toBe(true);
    expect(deleteButton('Visa').parentElement!.title).toBe(
      'Only an account without transactions can be deleted',
    );
    expect(deleteButton('Mastercard').disabled).toBe(false);
  });

  it('shows an empty state without accounts', async () => {
    await load([]);

    expect(root().textContent).toContain('No accounts yet');
  });

  it('offers a retry when loading fails', async () => {
    TestBed.tick();
    http.expectOne('/api/Accounts').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(root().querySelector('[role=alert]')!.textContent).toContain(
      'Could not load the accounts.',
    );
  });

  it('adds an account, then reloads and confirms', async () => {
    await load();
    component.editing.set(null);

    component.onFormSubmit({
      name: 'Savings',
      type: AccountType.Savings,
      format: StatementFormat.Neo,
    });
    const request = http.expectOne({ method: 'POST', url: '/api/Accounts' });
    expect(request.request.body).toEqual({
      name: 'Savings',
      type: AccountType.Savings,
      format: StatementFormat.Neo,
    });
    request.flush({
      id: 'a4',
      name: 'Savings',
      type: AccountType.Savings,
      format: StatementFormat.Cibc,
      transactionCount: 0,
    });

    expect(component.editing()).toBeUndefined();
    await reloaded();
    expect(messages()).toEqual(['Added “Savings”']);
  });

  it('keeps the panel open and explains a taken name', async () => {
    await load();
    component.editing.set(accounts[1]);

    component.onFormSubmit({
      name: 'Chequing',
      type: AccountType.CreditCard,
      format: StatementFormat.Neo,
    });
    const request = http.expectOne({ method: 'PUT', url: '/api/Accounts/a2' });
    // The type can't change, so it isn't sent.
    expect(request.request.body).toEqual({ name: 'Chequing', format: StatementFormat.Neo });
    request.flush(
      { status: 409, detail: 'An account named "Chequing" already exists.' },
      { status: 409, statusText: 'Conflict' },
    );

    expect(component.editing()).toBe(accounts[1]);
    expect(toasts.toasts()[0]).toEqual(
      expect.objectContaining({
        kind: 'error',
        message: 'An account named "Chequing" already exists.',
      }),
    );
  });

  it('deletes only after confirmation', async () => {
    await load();
    deleteButton('Mastercard').click();
    await fixture.whenStable();
    http.expectNone({ method: 'DELETE' });
    expect(root().querySelector('[role=alertdialog]')!.textContent).toContain(
      'Delete “Mastercard”?',
    );

    component.confirmDelete();
    http.expectOne({ method: 'DELETE', url: '/api/Accounts/a3' }).flush(null);

    await reloaded(accounts.slice(0, 2));
    expect(messages()).toEqual(['Deleted “Mastercard”']);
  });

  it('shows why a delete was refused', async () => {
    await load();
    component.deleting.set(accounts[2]);

    component.confirmDelete();
    http
      .expectOne({ method: 'DELETE', url: '/api/Accounts/a3' })
      .flush(
        { status: 409, detail: 'Mastercard has transactions, so it cannot be deleted.' },
        { status: 409, statusText: 'Conflict' },
      );

    await reloaded();
    expect(messages()).toEqual(['Mastercard has transactions, so it cannot be deleted.']);
  });

  describe('plans and balances', () => {
    const tfsa: AccountOutputDto = {
      id: 'a9',
      name: 'Wealthsimple TFSA',
      type: AccountType.Investment,
      format: StatementFormat.Manual,
      transactionCount: 4,
      plan: RegisteredPlan.Tfsa,
      contributionRoom: 7000,
      contributionRoomYear: 2026,
      depositedThisYear: 3500,
      withdrawnThisYear: 400,
      roomLeft: 3500,
      balance: { id: 'b1', date: '2026-09-30T00:00:00Z', amount: 12000 },
    };

    it("shows a plan's room left this year, and the latest balance", async () => {
      await load([tfsa]);

      const row = rows()[0];
      expect(row).toContain('Investment · No files (add by hand) · 4 transactions · TFSA');
      expect(row).toContain('$3,500.00 of $7,000.00 room left this year');
      expect(row).toContain('$400.00 out (room again in January)');
      expect(row).toMatch(/\$12,000\.00\s*Sep 30$/);
    });

    it('asks for the room when none was entered for this year', async () => {
      await load([{ ...tfsa, roomLeft: null }]);

      expect(rows()[0]).toContain("Enter this year's room (Edit) to see what's left.");
    });

    it('enters a balance, and lists and deletes the ones before', async () => {
      await load([tfsa]);
      root()
        .querySelector<HTMLButtonElement>('[aria-label="Balances of Wealthsimple TFSA"]')!
        .click();
      fixture.detectChanges();
      TestBed.tick();
      http
        .expectOne('/api/Accounts/a9/Balances')
        .flush([{ id: 'b1', date: '2026-09-30T00:00:00Z', amount: 12000 }]);
      await fixture.whenStable();
      expect(root().querySelector('[aria-label="Balances entered"]')!.textContent).toContain(
        '$12,000.00',
      );

      const date = root().querySelector<HTMLInputElement>('#balance-date')!;
      date.value = '2026-10-14';
      date.dispatchEvent(new Event('input'));
      const amount = root().querySelector<HTMLInputElement>('#balance-amount')!;
      amount.value = '12500.5';
      amount.dispatchEvent(new Event('input'));
      root()
        .querySelector<HTMLFormElement>('app-account-balances form')!
        .dispatchEvent(new Event('submit'));

      const save = http.expectOne({ method: 'POST', url: '/api/Accounts/a9/Balances' });
      expect(save.request.body).toEqual({ date: '2026-10-14', amount: 12500.5 });
      save.flush({ id: 'b2', date: '2026-10-14T00:00:00Z', amount: 12500.5 });
      // Both lists follow: the balances, and the accounts with their latest.
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
      http.expectOne('/api/Accounts/a9/Balances').flush([
        { id: 'b2', date: '2026-10-14T00:00:00Z', amount: 12500.5 },
        { id: 'b1', date: '2026-09-30T00:00:00Z', amount: 12000 },
      ]);
      http.expectOne('/api/Accounts').flush([tfsa]);
      await fixture.whenStable();
      expect(messages()).toEqual(['Balance saved']);

      root()
        .querySelector<HTMLButtonElement>('[aria-label="Delete the balance of Sep 30, 2026"]')!
        .click();
      await fixture.whenStable();
      // Only once confirmed.
      http.expectNone({ method: 'DELETE' });
      const confirm = root().querySelector('app-confirm-dialog')!;
      expect(confirm.textContent).toContain('Delete the balance of Sep 30, 2026?');
      Array.from(confirm.querySelectorAll<HTMLButtonElement>('button'))
        .find((b) => b.textContent!.trim() === 'Delete')!
        .click();
      http.expectOne({ method: 'DELETE', url: '/api/Accounts/a9/Balances/b1' }).flush(null);
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
      http.match('/api/Accounts/a9/Balances').forEach((r) => r.flush([]));
      http.match('/api/Accounts').forEach((r) => r.flush([tfsa]));
      await fixture.whenStable();
      expect(root().querySelector('app-confirm-dialog')).toBeNull();
    });

    it('takes a balance in whole cents only', async () => {
      await load([tfsa]);
      root()
        .querySelector<HTMLButtonElement>('[aria-label="Balances of Wealthsimple TFSA"]')!
        .click();
      fixture.detectChanges();
      TestBed.tick();
      http.expectOne('/api/Accounts/a9/Balances').flush([]);
      await fixture.whenStable();

      const amount = root().querySelector<HTMLInputElement>('#balance-amount')!;
      amount.value = '12.505';
      amount.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(root().querySelector('#balance-amount-error')!.textContent).toContain('Whole cents');
      expect(
        root().querySelector<HTMLButtonElement>('app-account-balances button[type="submit"]')!
          .disabled,
      ).toBe(true);
    });
  });
});
