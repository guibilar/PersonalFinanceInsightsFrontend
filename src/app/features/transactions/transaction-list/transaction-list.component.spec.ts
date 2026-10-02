import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TransactionListComponent } from './transaction-list.component';
import { TEST_CATEGORIES, TEST_CATEGORY_LIST } from '../../../testing/test-categories';
import { AccountType } from '../../../core/models/enums/account-type';
import { StatementFormat } from '../../../core/models/enums/statement-format';
import { Flow } from '../../../core/models/enums/flow';
import { TransactionType } from '../../../core/models/enums/transaction-type';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';
import { TransactionBreakdownOutputDto } from '../../../core/models/outputs/transaction-breakdown-output-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';

describe('TransactionListComponent', () => {
  let fixture: ComponentFixture<TransactionListComponent>;
  let component: TransactionListComponent;
  let http: HttpTestingController;

  const emptyBreakdown: TransactionBreakdownOutputDto = {
    interval: 'Month',
    count: 0,
    spending: 0,
    refunds: 0,
    income: 0,
    averageSpending: 0,
    averageIncome: 0,
    averagedPeriods: 0,
    periods: [],
    topMerchants: [],
    merchantCount: 0,
  };

  const emptyPage = {
    items: [],
    page: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TransactionListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(TransactionListComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    TestBed.tick();
    // The link dropdown's budgets are not part of these tests.
    http.match('/api/Budget/Filter').forEach((r) => r.flush(emptyPage));
    // Nor are the account filter's accounts, apart from their names.
    http.match('/api/Accounts').forEach((r) =>
      r.flush([
        {
          id: 'a2',
          name: 'Visa',
          type: AccountType.CreditCard,
          format: StatementFormat.Cibc,
          transactionCount: 1,
        },
      ]),
    );
    // Nor the categories the filter and forms offer.
    http.match('/api/Categories').forEach((r) => r.flush(TEST_CATEGORY_LIST));
  });

  afterEach(() => {
    flushBreakdowns();
    http.verify();
  });

  /** The totals over the list's criteria, which reload with it; tested on their own below. */
  function flushBreakdowns() {
    http
      .match('/api/Reports/breakdown')
      .filter((r) => !r.cancelled)
      .forEach((r) => r.flush(emptyBreakdown));
  }

  function lastFilterRequest() {
    TestBed.tick();
    flushBreakdowns();
    const requests = http.match('/api/Transaction/Filter');
    // A new filter cancels the previous request, as the app should; answer only the live ones.
    requests.filter((r) => !r.cancelled).forEach((r) => r.flush(emptyPage));
    return requests.at(-1)!.request.body;
  }

  it('loads newest first by default', () => {
    expect(lastFilterRequest()).toEqual(
      expect.objectContaining({ sortBy: 'Date', sortDirection: 'Descending', page: 1 }),
    );
  });

  it('flips direction on the same column and uses the natural direction for a new one', () => {
    component.sort('Date');
    expect(lastFilterRequest()).toEqual(
      expect.objectContaining({ sortBy: 'Date', sortDirection: 'Ascending' }),
    );

    component.sort('Description');
    expect(lastFilterRequest()).toEqual(
      expect.objectContaining({ sortBy: 'Description', sortDirection: 'Ascending' }),
    );

    component.sort('Amount');
    expect(lastFilterRequest()).toEqual(
      expect.objectContaining({ sortBy: 'Amount', sortDirection: 'Descending' }),
    );
    expect(component.ariaSort('Amount')).toBe('descending');
    expect(component.ariaSort('Date')).toBe('none');
  });

  it('keeps sort and page size when filters change, and goes back to page 1', () => {
    component.sort('Amount');
    component.onPageSizeChange(50);
    component.onPageChange(3);
    component.onCriteriaChange({ categoryId: TEST_CATEGORIES.dining.id });

    expect(lastFilterRequest()).toEqual({
      categoryId: TEST_CATEGORIES.dining.id,
      sortBy: 'Amount',
      sortDirection: 'Descending',
      pageSize: 50,
      page: 1,
    });
    expect(component.hasCriteria()).toBe(true);
  });

  it('filters by account and flow like the other criteria', () => {
    component.onCriteriaChange({ accountId: 'a2', flow: Flow.Income });

    expect(lastFilterRequest()).toEqual(
      expect.objectContaining({ accountId: 'a2', flow: Flow.Income, page: 1 }),
    );
    expect(component.hasCriteria()).toBe(true);
    expect(component.accounts().map((a) => a.name)).toEqual(['Visa']);
  });

  it('shows the account name and marks flows other than spending', async () => {
    TestBed.tick();
    const base = {
      date: '2026-09-10',
      amount: 5,
      category: TEST_CATEGORIES.other,
      categoryLocked: false,
      accountId: 'a2',
      accountName: 'Visa',
      accountType: AccountType.CreditCard,
      flowLocked: false,
      budgetId: '',
    };
    http.expectOne('/api/Transaction/Filter').flush({
      ...emptyPage,
      items: [
        { ...base, id: 't1', description: 'COFFEE', flow: Flow.Spending },
        {
          ...base,
          id: 't2',
          description: 'PAYMENT THANK YOU',
          flow: Flow.Transfer,
          flowLocked: true,
          transactionType: TransactionType.Credit,
        },
      ],
      totalCount: 2,
      totalPages: 1,
    });
    flushBreakdowns();
    await fixture.whenStable();
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'));

    expect(rows[0].textContent).toContain('Visa');
    expect(rows[0].querySelector('.flow-badge')).toBeNull();
    const badge = rows[1].querySelector('.flow-badge')!;
    expect(badge.textContent).toContain('Transfer');
    expect(badge.classList).toContain('flow-transfer');
    expect(badge.getAttribute('title')).toBe('Picked by hand: kept when rules are re-applied');
  });

  describe('editing and rules', () => {
    const coffee: TransactionOutputDto = {
      id: 't1',
      date: '2026-09-10',
      amount: 4,
      description: 'COFFEE',
      category: TEST_CATEGORIES.other,
      categoryLocked: false,
      accountId: 'a2',
      accountName: 'Visa',
      accountType: AccountType.CreditCard,
      flow: Flow.Spending,
      flowLocked: false,
      budgetId: '',
    };

    // reload() is ignored while the first load is still settling, so let it finish first.
    beforeEach(async () => {
      lastFilterRequest();
      await fixture.whenStable();
    });

    it('saves an edit, closes the panel and reloads', () => {
      component.editingTransaction.set(coffee);

      component.onEditSubmit({
        update: { description: 'Coffee', categoryId: TEST_CATEGORIES.dining.id },
      });
      const put = http.expectOne({ method: 'PUT', url: '/api/Transaction/t1' });
      expect(put.request.body).toEqual({
        description: 'Coffee',
        categoryId: TEST_CATEGORIES.dining.id,
      });
      expect(component.savingEdit()).toBe(true);
      put.flush({
        ...coffee,
        description: 'Coffee',
        category: TEST_CATEGORIES.dining,
        categoryLocked: true,
      });

      expect(component.editingTransaction()).toBeNull();
      expect(component.savingEdit()).toBe(false);
      lastFilterRequest();
      expect(
        TestBed.inject(ToastService)
          .toasts()
          .map((t) => t.message),
      ).toEqual(['Transaction updated']);
    });

    it('can also add a rule first and apply the rules, with one toast for it all', () => {
      component.editingTransaction.set(coffee);
      const rule = { keyword: 'COFFEE', categoryId: TEST_CATEGORIES.dining.id, position: 0 };

      component.onEditSubmit({
        update: { description: 'COFFEE', categoryId: TEST_CATEGORIES.dining.id },
        rule,
      });
      http
        .expectOne({ method: 'PUT', url: '/api/Transaction/t1' })
        .flush({ ...coffee, category: TEST_CATEGORIES.dining, categoryLocked: true });
      const create = http.expectOne({ method: 'POST', url: '/api/CategoryRules' });
      expect(create.request.body).toEqual(rule);
      expect(component.editingTransaction()).toEqual(coffee);
      create.flush({ id: 'r1', ...rule });
      http
        .expectOne({ method: 'POST', url: '/api/Transaction/ApplyRules' })
        .flush({ checked: 40, updated: 2 });

      expect(component.editingTransaction()).toBeNull();
      expect(component.savingEdit()).toBe(false);
      lastFilterRequest();
      expect(
        TestBed.inject(ToastService)
          .toasts()
          .map((t) => t.message),
      ).toEqual(['Transaction updated. Rule “COFFEE” added and 2 other transactions updated']);
    });

    it('says why the rule was not added, and still closes the saved edit', () => {
      component.editingTransaction.set(coffee);
      const rule = { keyword: 'COFFEE', categoryId: TEST_CATEGORIES.dining.id, position: 0 };

      component.onEditSubmit({
        update: { description: 'COFFEE', categoryId: TEST_CATEGORIES.dining.id },
        rule,
      });
      http.expectOne({ method: 'PUT', url: '/api/Transaction/t1' }).flush(coffee);
      http
        .expectOne({ method: 'POST', url: '/api/CategoryRules' })
        .flush(
          { status: 409, detail: 'A rule for "COFFEE" already exists.' },
          { status: 409, statusText: 'Conflict' },
        );

      http.expectNone('/api/Transaction/ApplyRules');
      expect(component.editingTransaction()).toBeNull();
      lastFilterRequest();
      expect(TestBed.inject(ToastService).toasts()[0]).toEqual(
        expect.objectContaining({
          kind: 'error',
          message:
            'Transaction updated, but the rule could not be added: A rule for "COFFEE" already exists.',
        }),
      );
    });

    it('keeps the panel open when saving fails', () => {
      component.editingTransaction.set(coffee);

      component.onEditSubmit({
        update: { description: 'Coffee', categoryId: TEST_CATEGORIES.dining.id },
      });
      http
        .expectOne({ method: 'PUT', url: '/api/Transaction/t1' })
        .flush(null, { status: 500, statusText: 'Error' });

      expect(component.editingTransaction()).toEqual(coffee);
      expect(component.savingEdit()).toBe(false);
    });

    it('says why a transaction could not be linked to a budget', () => {
      component.linkingTransaction.set(coffee);

      component.onLinkSubmit({ transactionId: 't1', budgetId: 'b1' });
      http.expectOne({ method: 'POST', url: '/api/Transaction/LinkTransaction' }).flush(
        {
          status: 409,
          detail: "Budget 'Trip' is inactive; activate it before linking transactions.",
        },
        { status: 409, statusText: 'Conflict' },
      );

      expect(component.savingLink()).toBe(false);
      expect(
        TestBed.inject(ToastService)
          .toasts()
          .map((t) => t.message),
      ).toEqual(["Budget 'Trip' is inactive; activate it before linking transactions."]);
    });

    it('deletes only after confirming, then closes the panel and reloads', () => {
      const toasts = TestBed.inject(ToastService);
      component.editingTransaction.set(coffee);
      component.deletingTransaction.set(coffee);
      http.expectNone({ method: 'DELETE' });

      component.confirmDelete();
      component.confirmDelete(); // a double click sends one request
      http.expectOne({ method: 'DELETE', url: '/api/Transaction/t1' }).flush(null);

      expect(component.deletingTransaction()).toBeNull();
      expect(component.editingTransaction()).toBeNull();
      lastFilterRequest();
      expect(toasts.toasts().map((t) => t.message)).toEqual(['Deleted “COFFEE”']);
    });

    it('keeps the transaction when deleting fails', () => {
      component.editingTransaction.set(coffee);
      component.deletingTransaction.set(coffee);

      component.confirmDelete();
      http
        .expectOne({ method: 'DELETE', url: '/api/Transaction/t1' })
        .flush(null, { status: 500, statusText: 'Error' });

      expect(component.editingTransaction()).toEqual(coffee);
      expect(component.removing()).toBe(false);
      expect(TestBed.inject(ToastService).toasts()[0]).toEqual(
        expect.objectContaining({ kind: 'error' }),
      );
    });

    it('lists deleted transactions, keeping search and sort, and restores one', async () => {
      component.sort('Amount');
      lastFilterRequest();
      component.toggleDeleted();
      expect(lastFilterRequest()).toEqual(
        expect.objectContaining({ hidden: true, sortBy: 'Amount', page: 1 }),
      );
      expect(component.showDeleted()).toBe(true);

      component.onCriteriaChange({ description: 'coffee' });
      expect(lastFilterRequest()).toEqual(
        expect.objectContaining({ hidden: true, description: 'coffee' }),
      );
      await fixture.whenStable();

      component.restore({ ...coffee, hidden: true });
      http.expectOne({ method: 'POST', url: '/api/Transaction/t1/Restore' }).flush(null);
      lastFilterRequest();
      expect(
        TestBed.inject(ToastService)
          .toasts()
          .map((t) => t.message),
      ).toEqual(['Restored “COFFEE”']);
      await fixture.whenStable();

      component.toggleDeleted();
      expect(lastFilterRequest().hidden).toBeUndefined();
      expect(component.showDeleted()).toBe(false);
    });

    it('applies the rules after confirming and reports what changed', () => {
      component.confirmingRules.set(true);

      component.applyRules();
      expect(component.confirmingRules()).toBe(false);
      expect(component.applyingRules()).toBe(true);
      http
        .expectOne({ method: 'POST', url: '/api/Transaction/ApplyRules' })
        .flush({ checked: 40, updated: 3 });

      expect(component.applyingRules()).toBe(false);
      lastFilterRequest();
      expect(
        TestBed.inject(ToastService)
          .toasts()
          .map((t) => t.message),
      ).toEqual(['Updated 3 of 40 transactions']);
    });
  });

  describe('adding by hand', () => {
    const input = {
      date: '2026-09-10',
      description: 'COFFEE',
      amount: 4.5,
      transactionType: TransactionType.Debit,
      accountId: 'a2',
    };

    beforeEach(async () => {
      lastFilterRequest();
      await fixture.whenStable();
    });

    it('adds, closes the form, reloads and confirms', () => {
      component.openAdd();
      component.onAddSubmit(input);
      expect(component.savingAdd()).toBe(true);
      http.expectOne({ method: 'POST', url: '/api/Transaction' }).flush({
        id: 't9',
        description: 'COFFEE',
        accountName: 'Visa',
      });

      expect(component.showAdd()).toBe(false);
      expect(component.savingAdd()).toBe(false);
      expect(component.lastAdded()).toEqual({ date: '2026-09-10', accountId: 'a2' });
      lastFilterRequest();
      expect(
        TestBed.inject(ToastService)
          .toasts()
          .map((t) => t.message),
      ).toEqual(['Added “COFFEE” to Visa']);
    });

    it('keeps the form open on a duplicate, and adds it anyway when asked', () => {
      component.openAdd();
      component.onAddSubmit(input);
      http
        .expectOne({ method: 'POST', url: '/api/Transaction' })
        .flush(
          { status: 409, detail: 'An identical transaction already exists.' },
          { status: 409, statusText: 'Conflict' },
        );

      expect(component.showAdd()).toBe(true);
      expect(component.addDuplicate()).toBe('An identical transaction already exists.');

      component.onAddSubmit({ ...input, allowDuplicate: true });
      const again = http.expectOne({ method: 'POST', url: '/api/Transaction' });
      expect(again.request.body).toEqual({ ...input, allowDuplicate: true });
      expect(component.addDuplicate()).toBeNull();
      again.flush({ id: 't10', description: 'COFFEE', accountName: 'Visa' });
      expect(component.showAdd()).toBe(false);
    });

    it('keeps the form open and says so when adding fails', () => {
      component.openAdd();
      component.onAddSubmit(input);
      http
        .expectOne({ method: 'POST', url: '/api/Transaction' })
        .flush(null, { status: 500, statusText: 'Error' });

      expect(component.showAdd()).toBe(true);
      expect(component.savingAdd()).toBe(false);
      expect(
        TestBed.inject(ToastService)
          .toasts()
          .map((t) => t.message),
      ).toEqual(['Could not add the transaction.']);
    });

    it('says why the API refused it', () => {
      component.openAdd();
      component.onAddSubmit(input);
      http
        .expectOne({ method: 'POST', url: '/api/Transaction' })
        .flush(
          { status: 400, errors: { categoryId: ["That category doesn't exist."] } },
          { status: 400, statusText: 'Bad Request' },
        );

      expect(component.showAdd()).toBe(true);
      expect(
        TestBed.inject(ToastService)
          .toasts()
          .map((t) => t.message),
      ).toEqual(["That category doesn't exist."]);
    });
  });

  describe('totals and over time', () => {
    it('totals the list’s criteria, without asking again when only the page or sort changes', async () => {
      TestBed.tick();
      const first = http.expectOne({ method: 'POST', url: '/api/Reports/breakdown' });
      expect(first.request.body).toEqual({ interval: 'Month' });
      first.flush(emptyBreakdown);
      lastFilterRequest();
      await fixture.whenStable();

      component.onPageChange(2);
      component.sort('Amount');
      TestBed.tick();
      http.expectNone('/api/Reports/breakdown');
      lastFilterRequest();

      component.onCriteriaChange({
        description: 'no frills',
        categoryId: TEST_CATEGORIES.groceries.id,
      });
      TestBed.tick();
      expect(http.expectOne('/api/Reports/breakdown').request.body).toEqual({
        description: 'no frills',
        categoryId: TEST_CATEGORIES.groceries.id,
        interval: 'Month',
      });
      lastFilterRequest();
    });

    it('lists the period of a clicked bar, and looks at it a step closer', async () => {
      lastFilterRequest();
      await fixture.whenStable();

      component.onPeriodPicked({
        start: '2026-09-01T00:00:00Z',
        end: '2026-09-30T00:00:00Z',
        label: 'Sep 2026',
        count: 3,
        spending: 70,
        income: 0,
        cumulativeSpending: 190,
        cumulativeIncome: 0,
      });

      expect(lastFilterRequest()).toEqual(
        expect.objectContaining({ startDate: '2026-09-01', endDate: '2026-09-30', page: 1 }),
      );
      expect(component.breakdownInterval()).toBe('Week');
    });

    it('asks for no totals while showing deleted transactions', async () => {
      lastFilterRequest();
      await fixture.whenStable();

      component.toggleDeleted();
      TestBed.tick();

      http.expectNone('/api/Reports/breakdown');
      lastFilterRequest();
    });
  });
});

describe('TransactionListComponent, in the address bar', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;

  const page = {
    items: [],
    page: 1,
    pageSize: 25,
    totalCount: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  };

  /** Answers what the page asked for; the totals in the interval they were asked in. */
  function answer(): { filter?: Record<string, unknown>; breakdown?: Record<string, unknown> } {
    TestBed.tick();
    http.match('/api/Budget/Filter').forEach((r) => r.flush(page));
    http.match('/api/Accounts').forEach((r) => r.flush([]));
    http.match('/api/Categories').forEach((r) => r.flush(TEST_CATEGORY_LIST));
    const filters = http.match('/api/Transaction/Filter').filter((r) => !r.cancelled);
    filters.forEach((r) => r.flush(page));
    const breakdowns = http.match('/api/Reports/breakdown').filter((r) => !r.cancelled);
    breakdowns.forEach((r) =>
      r.flush({
        interval: r.request.body.interval,
        count: 0,
        spending: 0,
        refunds: 0,
        income: 0,
        averageSpending: 0,
        averageIncome: 0,
        averagedPeriods: 0,
        periods: [],
        topMerchants: [],
        merchantCount: 0,
      }),
    );
    return { filter: filters.at(-1)?.request.body, breakdown: breakdowns.at(-1)?.request.body };
  }

  /**
   * Lets the page's own address update finish, answering what it asks for on the way (whenStable would wait for
   * those requests forever).
   */
  async function settle(): Promise<void> {
    for (let turn = 0; turn < 3; turn++) {
      answer();
      await new Promise((resolve) => setTimeout(resolve));
    }
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'transactions', component: TransactionListComponent }]),
        provideLocationMocks(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    answer();
    http.verify();
  });

  it('starts on the linked category and interval, with its chart open', async () => {
    const list = await harness.navigateByUrl(
      '/transactions?categoryId=c-dining&startDate=2026-09-01&endDate=2026-09-30&interval=Week&overTime=1',
      TransactionListComponent,
    );

    const { filter, breakdown } = answer();

    expect(filter).toEqual(
      expect.objectContaining({
        categoryId: 'c-dining',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      }),
    );
    expect(breakdown).toEqual(
      expect.objectContaining({ categoryId: 'c-dining', interval: 'Week' }),
    );
    expect(list.breakdownOpen()).toBe(true);
  });

  it('keeps the address up to date, so a refresh shows the same list', async () => {
    const list = await harness.navigateByUrl('/transactions', TransactionListComponent);
    answer();

    list.onCriteriaChange({ description: 'no frills', startDate: '2026-08-01' });
    await settle();
    expect(router.url).toBe('/transactions?description=no%20frills&startDate=2026-08-01');

    list.breakdownOpen.set(true);
    list.breakdownInterval.set('Week');
    await settle();
    expect(router.url).toBe(
      '/transactions?description=no%20frills&startDate=2026-08-01&overTime=1&interval=Week',
    );

    list.clearCriteria();
    list.breakdownOpen.set(false);
    await settle();
    expect(router.url).toBe('/transactions');
  });

  it('applies a link to the page while it is open, as the menu’s plain one', async () => {
    const list = await harness.navigateByUrl(
      '/transactions?categoryId=c-dining&overTime=1',
      TransactionListComponent,
    );
    answer();

    // The menu: the same page, without criteria.
    await harness.navigateByUrl('/transactions');
    const { filter } = answer();

    expect(filter).not.toHaveProperty('categoryId', 'c-dining');
    expect(list.filter().categoryId).toBeUndefined();
    expect(list.breakdownOpen()).toBe(false);
  });

  it('shows the interval the totals were charted in, when the asked one has too many periods', async () => {
    const list = await harness.navigateByUrl(
      '/transactions?startDate=2010-01-01&overTime=1&interval=Week',
      TransactionListComponent,
    );
    TestBed.tick();
    http.match('/api/Reports/breakdown').forEach((r) =>
      r.flush({
        interval: 'Month',
        count: 0,
        spending: 0,
        refunds: 0,
        income: 0,
        averageSpending: 0,
        averageIncome: 0,
        averagedPeriods: 0,
        periods: [],
        topMerchants: [],
        merchantCount: 0,
      }),
    );
    await settle();

    expect(list.breakdownInterval()).toBe('Month');
    expect(router.url).toBe('/transactions?startDate=2010-01-01&overTime=1');
  });
});
