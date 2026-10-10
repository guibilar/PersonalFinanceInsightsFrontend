import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UnsortedMerchantsComponent } from './unsorted-merchants.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { TEST_CATEGORIES, TEST_CATEGORY_LIST } from '../../testing/test-categories';
import { EMPTY_UNCATEGORISED, TEST_UNCATEGORISED } from '../../testing/test-insights';

describe('UnsortedMerchantsComponent', () => {
  let fixture: ComponentFixture<UnsortedMerchantsComponent>;
  let http: HttpTestingController;
  let added: number;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [UnsortedMerchantsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    fixture = TestBed.createComponent(UnsortedMerchantsComponent);
    fixture.componentRef.setInput('categories', TEST_CATEGORY_LIST);
    added = 0;
    fixture.componentInstance.ruleAdded.subscribe(() => added++);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    http.expectOne('/api/Reports/uncategorised').flush(TEST_UNCATEGORISED);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const root = () => fixture.nativeElement as HTMLElement;

  it('lists the merchants no rule names, offering Other only to keep them there', () => {
    expect(root().textContent).toContain('4 transactions are in Other');
    const inputs = Array.from(root().querySelectorAll<HTMLInputElement>('input'));
    expect(inputs.map((i) => i.value)).toEqual(['CORNER STORE', 'MYSTERY SHOP']);
    const options = Array.from(root().querySelectorAll('select')[0].options).map((o) =>
      o.text.trim(),
    );
    expect(options).not.toContain('Other');
    expect(options.at(-1)).toBe('Keep in Other');
  });

  it('keeps a merchant in Other with a rule into Other, so it is not listed again', async () => {
    const select = root().querySelectorAll('select')[1];
    select.value = TEST_CATEGORIES.other.id;
    select.dispatchEvent(new Event('change'));

    const create = http.expectOne({ method: 'POST', url: '/api/CategoryRules' });
    expect(create.request.body).toEqual({
      keyword: 'MYSTERY SHOP',
      categoryId: TEST_CATEGORIES.other.id,
    });
    create.flush({
      id: 'r9',
      keyword: 'MYSTERY SHOP',
      category: TEST_CATEGORIES.other,
      position: 9,
    });
    http.expectOne('/api/Transaction/ApplyRules').flush({ checked: 40, updated: 0 });
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    http.expectOne('/api/Reports/uncategorised').flush(EMPTY_UNCATEGORISED);
    await fixture.whenStable();

    expect(
      TestBed.inject(ToastService)
        .toasts()
        .map((t) => t.message),
    ).toEqual(["Rule “MYSTERY SHOP” added: it stays in Other and isn't listed here any more"]);
  });

  it('adds a rule for the edited keyword and applies the rules', async () => {
    const input = root().querySelector<HTMLInputElement>('input')!;
    input.value = 'corner store';
    input.dispatchEvent(new Event('input'));
    const select = root().querySelector('select')!;
    select.value = TEST_CATEGORIES.groceries.id;
    select.dispatchEvent(new Event('change'));

    const create = http.expectOne({ method: 'POST', url: '/api/CategoryRules' });
    expect(create.request.body).toEqual({
      keyword: 'CORNER STORE',
      categoryId: TEST_CATEGORIES.groceries.id,
    });
    create.flush({
      id: 'r9',
      keyword: 'CORNER STORE',
      category: TEST_CATEGORIES.groceries,
      position: 9,
    });
    http.expectOne('/api/Transaction/ApplyRules').flush({ checked: 40, updated: 3 });
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    http.expectOne('/api/Reports/uncategorised').flush(EMPTY_UNCATEGORISED);
    await fixture.whenStable();

    expect(
      TestBed.inject(ToastService)
        .toasts()
        .map((t) => t.message),
    ).toEqual(['Rule “CORNER STORE” added for Groceries: 3 transactions updated by the rules']);
    expect(added).toBe(1);
    // Nothing left: the card goes.
    expect(root().querySelector('section')).toBeNull();
  });
});
