import { signInAsReadOnly } from '../../testing/test-auth';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BudgetListComponent, budgetHealth } from './budget-list.component';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { Status } from '../../core/models/enums/status';
import { TEST_CATEGORIES, TEST_CATEGORY_LIST } from '../../testing/test-categories';
import { BudgetPeriod } from '../../core/models/enums/budget-period';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { EMPTY_FORECAST, TEST_FORECAST } from '../../testing/test-insights';

const food: BudgetOutputDto = {
  id: 'b1',
  name: 'Food',
  description: 'd',
  status: Status.Active,
  period: BudgetPeriod.Total,
  categories: [],
  totalAmount: 100,
  totalSpent: 50,
  totalRemaining: 50,
  percentageUsed: 50,
};
const page = {
  items: [food],
  page: 1,
  pageSize: 12,
  totalCount: 1,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
};

describe('budgetHealth', () => {
  it('is amber from 80% and red at the limit', () => {
    const at = (percentageUsed: number) => budgetHealth({ ...food, percentageUsed });
    expect([at(79), at(80), at(99.9), at(100), at(150)]).toEqual([
      'ok',
      'warning',
      'warning',
      'over',
      'over',
    ]);
  });
});

describe('BudgetListComponent', () => {
  let fixture: ComponentFixture<BudgetListComponent>;
  let component: BudgetListComponent;
  let http: HttpTestingController;
  let toasts: ToastService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [BudgetListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    fixture = TestBed.createComponent(BudgetListComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(ToastService);
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne('/api/Budget/Filter').flush(page);
    // For the budget form.
    http.match('/api/Categories').forEach((r) => r.flush(TEST_CATEGORY_LIST));
    http.match('/api/Reports/forecast').forEach((r) => r.flush(EMPTY_FORECAST));
    // Let the first load settle: reload() is ignored while a load is still in progress.
    await fixture.whenStable();
  });

  afterEach(() => {
    // Reloaded with the budgets after each change; its own test is below.
    http.match('/api/Reports/forecast').forEach((r) => r.flush(EMPTY_FORECAST));
    http.verify();
  });

  it('has no new, edit, or delete buttons for a read-only user (T75)', async () => {
    const labels = () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).map((b) =>
        (b.getAttribute('aria-label') ?? b.textContent!).trim(),
      );
    const writes = (all: string[]) => all.filter((l) => /new budget|^edit|^delete/i.test(l));
    expect(writes(labels()).length).toBeGreaterThan(0);

    await signInAsReadOnly(http);
    fixture.detectChanges();

    expect(writes(labels())).toEqual([]);
  });

  it('says where a monthly budget is heading at its usual pace', async () => {
    component.forecast.reload();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    http.expectOne('/api/Reports/forecast').flush(TEST_FORECAST);
    await fixture.whenStable();

    const card = (fixture.nativeElement as HTMLElement).querySelector('article')!;
    const line = card.querySelector('p.text-danger')!;
    expect(line.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'At this pace, $460.00 (115%) by the end of the month',
    );
  });

  it('deletes only after confirmation, then reloads and confirms with a toast', async () => {
    component.deleting.set(food);
    TestBed.tick();
    http.expectNone({ method: 'DELETE' });

    component.confirmDelete();
    http.expectOne({ method: 'DELETE', url: '/api/Budget/b1' }).flush(null);

    // resource.reload() sends its request asynchronously.
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    http.expectOne('/api/Budget/Filter').flush(page);
    // For the budget form.
    http.match('/api/Categories').forEach((r) => r.flush(TEST_CATEGORY_LIST));
    http.match('/api/Reports/forecast').forEach((r) => r.flush(EMPTY_FORECAST));

    expect(component.deleting()).toBeNull();
    expect(toasts.toasts().map((t) => t.message)).toEqual(['Deleted “Food”']);
  });

  it('shows an error toast when saving fails and keeps the panel open', () => {
    component.editing.set(food);

    component.onFormSubmit({
      id: 'b1',
      name: 'Food',
      description: 'd',
      amount: 120,
      status: Status.Active,
      period: BudgetPeriod.Total,
      categoryIds: [],
    });
    http
      .expectOne({ method: 'PUT', url: '/api/Budget/b1' })
      .flush(null, { status: 500, statusText: 'Error' });

    expect(component.editing()).toBe(food);
    expect(toasts.toasts()[0]).toEqual(
      expect.objectContaining({ kind: 'error', message: 'Could not save the budget.' }),
    );
  });

  it('explains a category that another budget already counts', () => {
    component.editing.set(food);

    component.onFormSubmit({
      id: 'b1',
      name: 'Food',
      description: 'd',
      amount: 120,
      status: Status.Active,
      period: BudgetPeriod.Monthly,
      categoryIds: [TEST_CATEGORIES.dining.id],
    });
    http
      .expectOne({ method: 'PUT', url: '/api/Budget/b1' })
      .flush(
        { status: 409, detail: 'Dining is already counted by the budget "Dining out".' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(component.editing()).toBe(food);
    expect(toasts.toasts()[0]).toEqual(
      expect.objectContaining({
        kind: 'error',
        message: 'Dining is already counted by the budget "Dining out".',
      }),
    );
  });

  it('sends one request when the form is submitted twice quickly', () => {
    const budget = {
      id: '',
      name: 'Food',
      description: 'd',
      amount: 120,
      status: Status.Active,
      period: BudgetPeriod.Total,
      categoryIds: [],
    };
    component.editing.set(null);

    component.onFormSubmit(budget);
    component.onFormSubmit(budget);

    const requests = http.match({ method: 'POST', url: '/api/Budget' });
    expect(requests.length).toBe(1);
    expect(component.saving()).toBe(true);
    requests[0].flush(null, { status: 201, statusText: 'Created' });
    expect(component.saving()).toBe(false);
    http.match('/api/Budget/Filter').forEach((r) => r.flush(page));
  });

  it('resets to page 1 when the criteria change', () => {
    component.onPageChange(2);
    component.onCriteriaChange({ status: Status.Inactive });
    TestBed.tick();

    const requests = http.match('/api/Budget/Filter');
    expect(requests.at(-1)!.request.body).toEqual({
      status: Status.Inactive,
      page: 1,
      pageSize: 12,
    });
    requests.filter((r) => !r.cancelled).forEach((r) => r.flush(page));
  });

  it('names the period and the merchant on a budget’s card', async () => {
    const yearly: BudgetOutputDto = {
      ...food,
      id: 'b2',
      name: 'Gym',
      period: BudgetPeriod.Yearly,
      merchant: 'gym',
      totalAmount: 1000,
      totalSpent: 120,
    };
    const holiday: BudgetOutputDto = {
      ...food,
      id: 'b3',
      name: 'Holiday food',
      period: BudgetPeriod.Custom,
      startDate: '2026-07-01T00:00:00Z',
      endDate: '2026-08-15T00:00:00Z',
    };

    component.onCriteriaChange({ status: Status.Active });
    TestBed.tick();
    http
      .match('/api/Budget/Filter')
      .filter((r) => !r.cancelled)
      .forEach((r) => r.flush({ ...page, items: [food, yearly, holiday], totalCount: 3 }));
    await fixture.whenStable();

    const card = (name: string) =>
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLElement>(`article[aria-label="${name}"]`)!
        .innerText.replace(/\s+/g, ' ');
    expect(card('Food')).not.toContain('Yearly');
    expect(card('Gym')).toContain('Yearly');
    expect(card('Gym')).toContain('of $1,000.00 this year');
    expect(card('Gym')).toContain('Spending at “gym”');
    expect(card('Holiday food')).toContain('Custom');
    expect(card('Holiday food')).toContain('of $100.00 · Jul 1 – Aug 15, 2026');
  });
});
