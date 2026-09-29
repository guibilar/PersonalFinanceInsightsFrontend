import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BankAccountListComponent } from './bank-account-list.component';
import { AccountType } from '../../core/models/enums/account-type';
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
      'Chequing Chequing · CIBC · 120 transactions',
      'Visa Credit card · Neo Financial · 1 transaction',
      'Mastercard Credit card · CIBC · 0 transactions',
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
});
