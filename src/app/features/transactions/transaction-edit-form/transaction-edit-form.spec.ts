import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  RULE_PREVIEW_DEBOUNCE_MS,
  TransactionEditForm,
  TransactionEditSubmission,
} from './transaction-edit-form';
import { AccountType } from '../../../core/models/enums/account-type';
import { TEST_CATEGORIES, TEST_CATEGORY_LIST } from '../../../testing/test-categories';
import { Flow } from '../../../core/models/enums/flow';
import { TransactionType } from '../../../core/models/enums/transaction-type';
import { TransactionOutputDto } from '../../../core/models/outputs/transaction-output-dto';

const cornerStore: TransactionOutputDto = {
  id: 't1',
  date: '2026-09-10',
  amount: 12,
  description: 'SQ *CORNER STORE #12 TORONTO',
  category: TEST_CATEGORIES.other,
  categoryLocked: false,
  transactionType: TransactionType.Debit,
  accountId: 'a2',
  accountName: 'Visa',
  accountType: AccountType.CreditCard,
  flow: Flow.Spending,
  flowLocked: false,
  budgetId: '',
};

describe('TransactionEditForm', () => {
  let fixture: ComponentFixture<TransactionEditForm>;
  let component: TransactionEditForm;
  let submitted: TransactionEditSubmission[];
  let http: HttpTestingController;

  function create(transaction: TransactionOutputDto = cornerStore): void {
    TestBed.configureTestingModule({
      imports: [TransactionEditForm],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TransactionEditForm);
    fixture.componentRef.setInput('transaction', transaction);
    fixture.componentRef.setInput('categories', TEST_CATEGORY_LIST);
    component = fixture.componentInstance;
    submitted = [];
    component.submitUpdate.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
  }

  beforeEach(() => create());

  afterEach(() => http.verify());

  it('prefills the current description and category', () => {
    expect(component.form.getRawValue()).toEqual(
      expect.objectContaining({
        description: 'SQ *CORNER STORE #12 TORONTO',
        categoryId: TEST_CATEGORIES.other.id,
        flow: Flow.Spending,
        alsoSimilar: false,
      }),
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Visa');
  });

  const flowOptions = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('#edit-flow option')).map(
      (o) => o.textContent?.trim(),
    );

  it('offers only the flows that fit money out', () => {
    expect(flowOptions()).toEqual(['Spending', 'Transfer', 'Ignored']);
  });

  it('offers only the flows that fit money in', () => {
    TestBed.resetTestingModule();
    create({ ...cornerStore, transactionType: TransactionType.Credit, flow: Flow.Refund });

    expect(flowOptions()).toEqual(['Refund', 'Income', 'Transfer', 'Ignored']);
  });

  it('says a changed flow is kept when rules are re-applied', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('#edit-flow-hint')!.textContent,
    ).toContain('If you change it, your choice is kept when rules are re-applied.');
  });

  it('sends the flow only when it changed', () => {
    component.onSubmit();
    component.form.controls.flow.setValue(Flow.Transfer);
    component.onSubmit();

    expect(submitted.map((s) => s.update)).toEqual([
      { description: 'SQ *CORNER STORE #12 TORONTO', categoryId: TEST_CATEGORIES.other.id },
      {
        description: 'SQ *CORNER STORE #12 TORONTO',
        categoryId: TEST_CATEGORIES.other.id,
        flow: Flow.Transfer,
      },
    ]);
  });

  it('emits the trimmed description and chosen category', () => {
    component.form.patchValue({
      description: '  Corner store  ',
      categoryId: TEST_CATEGORIES.groceries.id,
    });

    component.onSubmit();

    expect(submitted).toEqual([
      { update: { description: 'Corner store', categoryId: TEST_CATEGORIES.groceries.id } },
    ]);
  });

  it('does not submit a blank description', () => {
    component.form.controls.description.setValue('   ');

    component.onSubmit();

    expect(submitted).toEqual([]);
    expect(component.form.controls.description.touched).toBe(true);
  });

  it('disables Save while saving', () => {
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    const save: HTMLButtonElement = fixture.nativeElement.querySelector('button[type=submit]');
    expect(save.disabled).toBe(true);
    expect(save.textContent).toContain('Saving');
  });

  it('asks the page to delete, which then asks for confirmation', () => {
    let requested = 0;
    component.deleteRequested.subscribe(() => requested++);

    const button = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((b) => b.textContent?.includes('Delete'))!;
    button.click();

    expect(requested).toBe(1);
    expect(submitted).toEqual([]);
  });

  it('limits the description to 200 characters, like the API', async () => {
    component.form.controls.description.setValue('x'.repeat(201));
    component.form.markAllAsTouched();
    await fixture.whenStable();

    component.onSubmit();

    expect(submitted).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('At most 200 characters.');
    component.form.controls.description.setValue('x'.repeat(200));
    expect(component.form.valid).toBe(true);
  });

  describe('also categorising similar transactions', () => {
    const root = () => fixture.nativeElement as HTMLElement;
    const wait = () => new Promise((resolve) => setTimeout(resolve, RULE_PREVIEW_DEBOUNCE_MS + 50));

    async function changeCategoryAndOptIn(): Promise<void> {
      component.form.controls.categoryId.setValue(TEST_CATEGORIES.groceries.id);
      component.form.controls.alsoSimilar.setValue(true);
      await fixture.whenStable();
    }

    it('is offered only once the category changes', async () => {
      expect(root().querySelector('#edit-also-similar')).toBeNull();

      component.form.controls.categoryId.setValue(TEST_CATEGORIES.groceries.id);
      await fixture.whenStable();

      const checkbox = root().querySelector<HTMLInputElement>('#edit-also-similar')!;
      expect(checkbox.checked).toBe(false);
      expect(root().querySelector('label[for=edit-also-similar]')!.textContent).toContain(
        'Also categorise similar transactions',
      );
    });

    it('suggests the merchant as keyword and previews what would change', async () => {
      await changeCategoryAndOptIn();
      expect(root().querySelector<HTMLInputElement>('#edit-rule-keyword')!.value).toBe(
        'CORNER STORE',
      );
      http.expectNone('/api/CategoryRules/Preview');

      await wait();
      TestBed.tick();
      const request = http.expectOne({ method: 'POST', url: '/api/CategoryRules/Preview' });
      expect(request.request.body).toEqual({
        keyword: 'CORNER STORE',
        categoryId: TEST_CATEGORIES.groceries.id,
        excludeTransactionId: 't1',
      });
      request.flush({ count: 3, examples: ['SQ *CORNER STORE #3', 'CORNER STORE WEST'] });
      await fixture.whenStable();

      const text = root().querySelector('#edit-rule-preview')!.textContent;
      expect(text).toContain('3 other transactions will change to Groceries');
      expect(root().textContent).toContain('CORNER STORE WEST');
    });

    it('asks once after typing stops', async () => {
      await changeCategoryAndOptIn();
      component.form.controls.ruleKeyword.setValue('CORNER');
      component.form.controls.ruleKeyword.setValue('corner st');

      await wait();
      TestBed.tick();
      const request = http.expectOne('/api/CategoryRules/Preview');
      expect(request.request.body.keyword).toBe('CORNER ST');
      request.flush({ count: 0, examples: [] });
      await fixture.whenStable();

      expect(root().querySelector('#edit-rule-preview')!.textContent).toContain(
        'No other transactions will change.',
      );
    });

    it('submits the rule, first in order, with the update', async () => {
      await changeCategoryAndOptIn();
      component.form.controls.ruleKeyword.setValue(' corner store ');

      component.onSubmit();

      expect(submitted).toEqual([
        {
          update: {
            description: 'SQ *CORNER STORE #12 TORONTO',
            categoryId: TEST_CATEGORIES.groceries.id,
          },
          rule: { keyword: 'CORNER STORE', categoryId: TEST_CATEGORIES.groceries.id, position: 0 },
        },
      ]);
      http.match('/api/CategoryRules/Preview').forEach((r) => r.flush({ count: 0, examples: [] }));
    });

    it('needs a keyword while the option is on', async () => {
      await changeCategoryAndOptIn();
      component.form.controls.ruleKeyword.setValue('  ');

      component.onSubmit();

      expect(submitted).toEqual([]);
    });

    it('turns the option off when the original category is picked again', async () => {
      await changeCategoryAndOptIn();
      component.form.controls.categoryId.setValue(TEST_CATEGORIES.other.id);
      await fixture.whenStable();

      component.onSubmit();

      expect(component.form.controls.alsoSimilar.value).toBe(false);
      expect(submitted).toEqual([
        {
          update: {
            description: 'SQ *CORNER STORE #12 TORONTO',
            categoryId: TEST_CATEGORIES.other.id,
          },
        },
      ]);
    });
  });
});
