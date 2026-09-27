import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BudgetListComponent, budgetHealth } from './budget-list.component';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { Status } from '../../core/models/enums/status';
import { BudgetPeriod } from '../../core/models/enums/budget-period';
import { ToastService } from '../../shared/ui/toast/toast.service';

const food: BudgetOutputDto = {
  id: 'b1',
  name: 'Food',
  description: 'd',
  status: Status.Active,
  period: BudgetPeriod.Total,
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
    // Let the first load settle: reload() is ignored while a load is still in progress.
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

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
    });
    http
      .expectOne({ method: 'PUT', url: '/api/Budget/b1' })
      .flush(null, { status: 500, statusText: 'Error' });

    expect(component.editing()).toBe(food);
    expect(toasts.toasts()[0]).toEqual(
      jasmine.objectContaining({ kind: 'error', message: 'Could not save the budget.' }),
    );
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
});
