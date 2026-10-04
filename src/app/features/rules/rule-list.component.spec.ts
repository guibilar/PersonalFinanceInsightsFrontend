import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { RuleListComponent } from './rule-list.component';
import { TEST_CATEGORIES, TEST_CATEGORY_LIST } from '../../testing/test-categories';
import { CategoryRuleOutputDto } from '../../core/models/outputs/category-rule-output-dto';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { EMPTY_UNCATEGORISED } from '../../testing/test-insights';

const rules: CategoryRuleOutputDto[] = [
  { id: 'r1', keyword: 'METRO', category: TEST_CATEGORIES.groceries, position: 0 },
  { id: 'r2', keyword: 'PIZZA', category: TEST_CATEGORIES.dining, position: 1 },
  { id: 'r3', keyword: 'UBER', category: TEST_CATEGORIES.transportation, position: 2 },
];

describe('RuleListComponent', () => {
  let fixture: ComponentFixture<RuleListComponent>;
  let component: RuleListComponent;
  let http: HttpTestingController;
  let toasts: ToastService;

  const root = () => fixture.nativeElement as HTMLElement;
  const keywords = () =>
    Array.from(root().querySelectorAll('.rule-keyword')).map((e) => e.textContent!.trim());
  const messages = () => toasts.toasts().map((t) => t.message);

  async function load(list: CategoryRuleOutputDto[] = rules): Promise<void> {
    TestBed.tick();
    http.expectOne({ method: 'GET', url: '/api/CategoryRules' }).flush(list);
    // The flow rules tab has its own tests.
    http.match({ method: 'GET', url: '/api/FlowRules' }).forEach((r) => r.flush([]));
    // What is left in Other has its own tests.
    http.match('/api/Reports/uncategorised').forEach((r) => r.flush(EMPTY_UNCATEGORISED));
    // Let the load settle: reload() is ignored while a load is still in progress.
    await fixture.whenStable();
  }

  async function reloaded(list: CategoryRuleOutputDto[] = rules): Promise<void> {
    // resource.reload() sends its request asynchronously.
    await new Promise((resolve) => setTimeout(resolve));
    await load(list);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RuleListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        // Tabs are kept in the URL; a mock location keeps each test's URL to itself.
        provideLocationMocks(),
      ],
    });
    fixture = TestBed.createComponent(RuleListComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(ToastService);
    fixture.detectChanges();
    // Loaded with the page for the rule form.
    TestBed.tick();
    http.expectOne({ method: 'GET', url: '/api/Categories' }).flush(TEST_CATEGORY_LIST);
  });

  afterEach(() => {
    // Answered in load(); a test that loads the rules itself leaves it to here.
    http.match('/api/Reports/uncategorised').forEach((r) => r.flush(EMPTY_UNCATEGORISED));
    http.verify();
  });

  it('lists the rules in order, with their category', async () => {
    await load();

    expect(keywords()).toEqual(['METRO', 'PIZZA', 'UBER']);
    expect(root().querySelector('.rule-row')!.textContent).toContain('Groceries');
    expect(root().textContent).toContain('3 rules');
  });

  it('filters by keyword or category, case-insensitively', async () => {
    await load();

    component.search.setValue('pizz');
    await fixture.whenStable();
    expect(keywords()).toEqual(['PIZZA']);

    component.search.setValue('transport');
    await fixture.whenStable();
    expect(keywords()).toEqual(['UBER']);
    expect(root().textContent).toContain('1 of 3 rules');

    component.search.setValue('nothing like it');
    await fixture.whenStable();
    expect(root().textContent).toContain('No rules match “nothing like it”.');
  });

  it('shows an empty state without rules', async () => {
    await load([]);

    expect(root().textContent).toContain('No rules yet');
  });

  it('offers a retry when loading fails', async () => {
    TestBed.tick();
    http.expectOne('/api/CategoryRules').flush(null, { status: 500, statusText: 'Error' });
    http.match('/api/Reports/uncategorised').forEach((r) => r.flush(EMPTY_UNCATEGORISED));
    await fixture.whenStable();

    expect(root().querySelector('[role=alert]')!.textContent).toContain(
      'Could not load the category rules.',
    );
  });

  it('moves a rule and shows the new order from the answer', async () => {
    await load();
    const moveDown = root().querySelector<HTMLButtonElement>('[aria-label="Move PIZZA down"]')!;
    expect(root().querySelector<HTMLButtonElement>('[aria-label="Move METRO up"]')!.disabled).toBe(
      true,
    );
    expect(root().querySelector<HTMLButtonElement>('[aria-label="Move UBER down"]')!.disabled).toBe(
      true,
    );

    moveDown.click();
    moveDown.click(); // ignored while the first move is on its way
    const request = http.expectOne({ method: 'POST', url: '/api/CategoryRules/r2/Move' });
    expect(request.request.body).toEqual({ position: 2 });
    request.flush([{ ...rules[0] }, { ...rules[2], position: 1 }, { ...rules[1], position: 2 }]);
    await fixture.whenStable();

    expect(keywords()).toEqual(['METRO', 'UBER', 'PIZZA']);
    expect(component.moving()).toBe(false);
  });

  it('while searching, moves a rule past the one shown next to it, not a hidden one', async () => {
    // A search for groceries shows METRO and FRESHCO, with the two transport rules hidden between them.
    await load([
      { id: 'r1', keyword: 'METRO', category: TEST_CATEGORIES.groceries, position: 0 },
      { id: 'r2', keyword: 'UBER', category: TEST_CATEGORIES.transportation, position: 1 },
      { id: 'r3', keyword: 'LYFT', category: TEST_CATEGORIES.transportation, position: 2 },
      { id: 'r4', keyword: 'FRESHCO', category: TEST_CATEGORIES.groceries, position: 3 },
    ]);
    component.search.setValue('groceries');
    await fixture.whenStable();
    expect(keywords()).toEqual(['METRO', 'FRESHCO']);
    const button = (label: string) =>
      root().querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;

    // The ends of what is shown, not of the whole list.
    expect(button('Move FRESHCO down').disabled).toBe(true);
    expect(button('Move METRO up').disabled).toBe(true);

    button('Move FRESHCO up').click();
    const request = http.expectOne({ method: 'POST', url: '/api/CategoryRules/r4/Move' });
    // METRO's place: FRESHCO goes above it, past the two hidden rules.
    expect(request.request.body).toEqual({ position: 0 });
    request.flush([]);
  });

  it('adds a rule, then reloads and confirms', async () => {
    await load();
    component.editing.set(null);

    component.onFormSubmit({
      keyword: 'corner store',
      categoryId: TEST_CATEGORIES.groceries.id,
      position: 0,
    });
    http.expectOne({ method: 'POST', url: '/api/CategoryRules' }).flush({
      id: 'r4',
      keyword: 'CORNER STORE',
      category: TEST_CATEGORIES.groceries,
      position: 0,
    });

    expect(component.editing()).toBeUndefined();
    await reloaded();
    expect(messages()).toEqual(['Added “CORNER STORE”']);
  });

  it('keeps the panel open and explains a duplicate keyword', async () => {
    await load();
    component.editing.set(rules[1]);

    component.onFormSubmit({ keyword: 'METRO', categoryId: TEST_CATEGORIES.dining.id });
    http
      .expectOne({ method: 'PUT', url: '/api/CategoryRules/r2' })
      .flush(
        { status: 409, detail: 'A rule for "METRO" already exists.' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(component.editing()).toBe(rules[1]);
    expect(toasts.toasts()[0]).toEqual(
      expect.objectContaining({ kind: 'error', message: 'A rule for "METRO" already exists.' }),
    );
  });

  it('deletes only after confirmation', async () => {
    await load();
    root().querySelector<HTMLButtonElement>('[aria-label="Delete UBER"]')!.click();
    await fixture.whenStable();
    http.expectNone({ method: 'DELETE' });
    expect(root().querySelector('[role=alertdialog]')!.textContent).toContain('Delete rule?');

    component.confirmDelete();
    http.expectOne({ method: 'DELETE', url: '/api/CategoryRules/r3' }).flush(null);

    await reloaded(rules.slice(0, 2));
    expect(messages()).toEqual(['Deleted “UBER”']);
  });

  describe('tabs', () => {
    const tab = (id: string) => root().querySelector<HTMLButtonElement>(`#rules-tab-${id}`)!;
    const selectedTab = () =>
      root().querySelector('[role="tab"][aria-selected="true"]')!.textContent!.trim();
    /** Lets the tab change reach the URL and the page, answering the flow rules request if it opens them. */
    async function settle(): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
      http.match({ method: 'GET', url: '/api/FlowRules' }).forEach((r) => r.flush([]));
      // Back on the categories, what is left in Other loads again.
      http.match('/api/Reports/uncategorised').forEach((r) => r.flush(EMPTY_UNCATEGORISED));
      await fixture.whenStable();
    }

    it('opens on the category rules, without loading the flow rules', async () => {
      await load();

      expect(selectedTab()).toBe('Categories');
      expect(keywords()).toEqual(['METRO', 'PIZZA', 'UBER']);
      expect(root().querySelector('app-flow-rule-list')).toBeNull();
      http.expectNone('/api/FlowRules');
    });

    it('switches to the flow rules and keeps the choice in the URL', async () => {
      await load();

      tab('flows').click();
      await settle();

      expect(TestBed.inject(Router).url).toBe('/?tab=flows');
      expect(selectedTab()).toBe('Money in and transfers');
      expect(root().querySelector('app-flow-rule-list')).not.toBeNull();
      expect(root().querySelector('#rules-panel-categories')).toBeNull();
    });

    it('opens the tab named in the URL', async () => {
      await load();

      await TestBed.inject(Router).navigateByUrl('/?tab=flows');
      await settle();

      expect(selectedTab()).toBe('Money in and transfers');
    });

    it('moves between the tabs with the arrow keys, keeping one tab stop', async () => {
      await load();

      tab('categories').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      await settle();

      expect(selectedTab()).toBe('Money in and transfers');
      expect([tab('categories').tabIndex, tab('flows').tabIndex]).toEqual([-1, 0]);
      expect(document.activeElement).toBe(tab('flows'));

      tab('flows').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
      await settle();
      expect(selectedTab()).toBe('Categories');
    });
  });

  it('applies the category and flow rules to transactions after confirming', async () => {
    await load();
    component.confirmingApply.set(true);

    component.applyRules();
    expect(component.applying()).toBe(true);
    http
      .expectOne({ method: 'POST', url: '/api/Transaction/ApplyRules' })
      .flush({ checked: 40, updated: 3 });

    expect(component.confirmingApply()).toBe(false);
    expect(component.applying()).toBe(false);
    expect(messages()).toEqual(['Updated 3 of 40 transactions']);
  });
});
