import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CategoryListComponent } from './category-list.component';
import { CategoryOutputDto } from '../../core/models/outputs/category-output-dto';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { TEST_CATEGORIES } from '../../testing/test-categories';

const categories: CategoryOutputDto[] = [
  { ...TEST_CATEGORIES.dining, transactionCount: 12, ruleCount: 3 },
  { ...TEST_CATEGORIES.other, transactionCount: 1, ruleCount: 0 },
  TEST_CATEGORIES.shopping,
];

describe('CategoryListComponent', () => {
  let fixture: ComponentFixture<CategoryListComponent>;
  let component: CategoryListComponent;
  let http: HttpTestingController;
  let toasts: ToastService;

  const root = () => fixture.nativeElement as HTMLElement;
  const rows = () =>
    // innerText: the name and the counts are separate lines.
    Array.from(root().querySelectorAll<HTMLElement>('.category-row')).map((e) =>
      e.innerText.replace(/\s+/g, ' ').trim(),
    );
  const messages = () => toasts.toasts().map((t) => t.message);
  const deleteButton = (name: string) =>
    root().querySelector<HTMLButtonElement>(`[aria-label="Delete ${name}"]`)!;

  async function load(list: CategoryOutputDto[] = categories): Promise<void> {
    TestBed.tick();
    http.expectOne({ method: 'GET', url: '/api/Categories' }).flush(list);
    await fixture.whenStable();
  }

  async function reloaded(list: CategoryOutputDto[] = categories): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await load(list);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CategoryListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    fixture = TestBed.createComponent(CategoryListComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('lists the categories with what uses them, marking the built-in ones', async () => {
    await load();

    expect(rows()).toEqual([
      'Dining 12 transactions · 3 rules',
      'Other Built in 1 transaction · 0 rules',
      'Shopping 0 transactions · 0 rules',
    ]);
  });

  it('lets every category but the built-in ones be deleted, and says why', async () => {
    await load();

    expect(deleteButton('Dining').disabled).toBe(false);
    expect(deleteButton('Other').disabled).toBe(true);
    expect(deleteButton('Other').parentElement!.title).toBe(
      'Built in: transactions that no rule matches go here.',
    );
  });

  it('offers a retry when loading fails', async () => {
    TestBed.tick();
    http.expectOne('/api/Categories').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(root().querySelector('[role=alert]')!.textContent).toContain(
      'Could not load the categories.',
    );
  });

  it('adds a category, then reloads and confirms', async () => {
    await load();
    component.editing.set(null);

    component.onFormSubmit({ name: 'Coffee', color: '#6F4E37' });
    const request = http.expectOne({ method: 'POST', url: '/api/Categories' });
    expect(request.request.body).toEqual({ name: 'Coffee', color: '#6F4E37' });
    request.flush({ id: 'c9', name: 'Coffee', color: '#6F4E37' });

    expect(component.editing()).toBeUndefined();
    await reloaded();
    expect(messages()).toEqual(['Added “Coffee”']);
  });

  it('keeps the form open and explains a taken name', async () => {
    await load();
    component.editing.set(categories[0]);

    component.onFormSubmit({ name: 'Shopping', color: '#1F76B5' });
    http
      .expectOne({ method: 'PUT', url: `/api/Categories/${TEST_CATEGORIES.dining.id}` })
      .flush(
        { status: 409, detail: 'A category named "Shopping" already exists.' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(component.editing()).toBe(categories[0]);
    expect(messages()).toEqual(['A category named "Shopping" already exists.']);
  });

  it('deletes after asking where its transactions and rules go, and says where they went', async () => {
    await load();
    deleteButton('Dining').click();
    await fixture.whenStable();
    expect(root().querySelector('dialog')!.textContent).toContain('Delete “Dining”?');

    component.confirmDelete(TEST_CATEGORIES.other.id);
    const request = http.expectOne(
      (r) => r.method === 'DELETE' && r.url === `/api/Categories/${TEST_CATEGORIES.dining.id}`,
    );
    expect(request.request.params.get('moveTo')).toBe(TEST_CATEGORIES.other.id);
    request.flush(null);

    expect(component.deleting()).toBeNull();
    await reloaded(categories.slice(1));
    expect(messages()).toEqual(['Deleted “Dining”; what used it is now in “Other”']);
  });

  it('shows why a delete was refused', async () => {
    await load();
    component.deleting.set(categories[2]);

    component.confirmDelete(TEST_CATEGORIES.other.id);
    http
      .expectOne((r) => r.method === 'DELETE')
      .flush(
        { status: 409, detail: '"Shopping" can\'t be deleted.' },
        { status: 409, statusText: 'Conflict' },
      );

    await reloaded();
    expect(messages()).toEqual(['"Shopping" can\'t be deleted.']);
  });
});
