import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TransactionAddPanel } from './transaction-add-panel';
import { AccountType } from '../../../core/models/enums/account-type';
import { Flow } from '../../../core/models/enums/flow';
import { StatementFormat } from '../../../core/models/enums/statement-format';
import { TransactionType } from '../../../core/models/enums/transaction-type';
import { TransactionInputDto } from '../../../core/models/inputs/transaction-input-dto';
import { AccountOutputDto } from '../../../core/models/outputs/account-output-dto';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { TEST_CATEGORIES, TEST_CATEGORY_LIST } from '../../../testing/test-categories';

const accounts: AccountOutputDto[] = [
  {
    id: 'a1',
    name: 'Visa',
    type: AccountType.CreditCard,
    format: StatementFormat.Cibc,
    transactionCount: 3,
  },
];

const input: TransactionInputDto = {
  date: '2026-10-09',
  description: 'Farmers market',
  amount: 24.5,
  transactionType: TransactionType.Debit,
  accountId: 'a1',
};

const saved: TransactionOutputDto = {
  id: 't9',
  date: '2026-10-09',
  amount: 24.5,
  description: 'Farmers market',
  category: TEST_CATEGORIES.other,
  categoryLocked: false,
  transactionType: TransactionType.Debit,
  accountId: 'a1',
  accountName: 'Visa',
  accountType: AccountType.CreditCard,
  flow: Flow.Spending,
  flowLocked: false,
  budgetId: '',
};

describe('TransactionAddPanel', () => {
  let fixture: ComponentFixture<TransactionAddPanel>;
  let component: TransactionAddPanel;
  let http: HttpTestingController;
  let added: TransactionOutputDto[];

  const root = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TransactionAddPanel],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(TransactionAddPanel);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    added = [];
    component.added.subscribe((transaction) => added.push(transaction));
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function load(accountList = accounts): Promise<void> {
    http.expectOne('/api/Accounts').flush(accountList);
    http.expectOne('/api/Categories').flush(TEST_CATEGORY_LIST);
    await fixture.whenStable();
  }

  it('shows the add form with the accounts and categories', async () => {
    await load();

    const options = Array.from(root().querySelectorAll('#add-account option')).map((o) =>
      o.textContent!.trim(),
    );
    expect(options.some((option) => option.startsWith('Visa'))).toBe(true);
    expect(root().querySelectorAll('#add-category option').length).toBe(
      TEST_CATEGORY_LIST.length + 1,
    );
  });

  it('sends to the accounts page when there are no accounts', async () => {
    await load([]);

    expect(root().querySelector('app-transaction-add-form')).toBeNull();
    expect(root().querySelector('a')!.getAttribute('href')).toBe('/money/accounts');
  });

  it('can retry when the accounts do not load', async () => {
    http.expectOne('/api/Accounts').flush(null, { status: 500, statusText: 'Server Error' });
    http.expectOne('/api/Categories').flush(TEST_CATEGORY_LIST);
    await fixture.whenStable();
    expect(root().querySelector('[role="alert"]')!.textContent).toContain(
      'Could not load your accounts',
    );

    root().querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    TestBed.tick();
    // Only what failed loads again.
    http.expectOne('/api/Accounts').flush(accounts);
    await fixture.whenStable();
    expect(root().querySelector('app-transaction-add-form')).not.toBeNull();
  });

  it('saves the transaction and says which one was added', async () => {
    await load();

    component.onSubmit(input);
    expect(component.saving()).toBe(true);
    const request = http.expectOne({ method: 'POST', url: '/api/Transaction' });
    expect(request.request.body).toEqual(input);
    request.flush(saved);

    expect(component.saving()).toBe(false);
    expect(added).toEqual([saved]);
  });

  it('offers to add a duplicate anyway', async () => {
    await load();

    component.onSubmit(input);
    http
      .expectOne({ method: 'POST', url: '/api/Transaction' })
      .flush(
        { status: 409, detail: 'An identical transaction already exists.' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(component.duplicate()).toBe('An identical transaction already exists.');
    expect(added).toEqual([]);
  });

  it('shows other errors as a toast', async () => {
    await load();

    component.onSubmit(input);
    http
      .expectOne({ method: 'POST', url: '/api/Transaction' })
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(TestBed.inject(ToastService).toasts()[0].message).toBe('Could not add the transaction.');
    expect(added).toEqual([]);
  });

  it('says why the API refused it', async () => {
    await load();

    component.onSubmit(input);
    http
      .expectOne({ method: 'POST', url: '/api/Transaction' })
      .flush(
        { status: 400, errors: { categoryId: ["That category doesn't exist."] } },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(component.saving()).toBe(false);
    expect(TestBed.inject(ToastService).toasts()[0].message).toBe("That category doesn't exist.");
    expect(added).toEqual([]);
  });

  it('adds a duplicate when asked, and clears the warning', async () => {
    await load();
    component.duplicate.set('An identical transaction already exists.');

    component.onSubmit({ ...input, allowDuplicate: true });
    expect(component.duplicate()).toBeNull();
    const request = http.expectOne({ method: 'POST', url: '/api/Transaction' });
    expect(request.request.body).toEqual({ ...input, allowDuplicate: true });
    request.flush(saved);

    expect(added).toEqual([saved]);
  });
});
