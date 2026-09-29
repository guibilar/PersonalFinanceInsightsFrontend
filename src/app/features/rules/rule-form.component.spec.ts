import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RuleFormComponent } from './rule-form.component';
import { TEST_CATEGORIES, TEST_CATEGORY_LIST } from '../../testing/test-categories';
import { CategoryRuleInputDto } from '../../core/models/inputs/category-rule-input-dto';
import { CategoryRuleOutputDto } from '../../core/models/outputs/category-rule-output-dto';

describe('RuleFormComponent', () => {
  let fixture: ComponentFixture<RuleFormComponent>;
  let component: RuleFormComponent;
  let submitted: CategoryRuleInputDto[];

  function create(rule: CategoryRuleOutputDto | null) {
    TestBed.configureTestingModule({
      imports: [RuleFormComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(RuleFormComponent);
    fixture.componentRef.setInput('rule', rule);
    fixture.componentRef.setInput('categories', TEST_CATEGORY_LIST);
    component = fixture.componentInstance;
    submitted = [];
    component.submitRule.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
  }

  it('adds a new rule first by default, with a trimmed keyword', () => {
    create(null);
    component.form.patchValue({
      keyword: '  corner store ',
      categoryId: TEST_CATEGORIES.groceries.id,
    });

    component.onSubmit();

    expect(submitted).toEqual([
      { keyword: 'corner store', categoryId: TEST_CATEGORIES.groceries.id, position: 0 },
    ]);
  });

  it('can add it last instead', () => {
    create(null);
    component.form.patchValue({
      keyword: 'BAKERY',
      categoryId: TEST_CATEGORIES.dining.id,
      placement: 'last',
    });

    component.onSubmit();

    expect(submitted).toEqual([{ keyword: 'BAKERY', categoryId: TEST_CATEGORIES.dining.id }]);
  });

  it('edits a rule without the order choice', () => {
    create({ id: 'r1', keyword: 'METRO', category: TEST_CATEGORIES.groceries, position: 4 });
    const root = fixture.nativeElement as HTMLElement;

    expect(component.form.controls.keyword.value).toBe('METRO');
    expect(root.querySelector('#rule-placement-first')).toBeNull();
    component.form.controls.categoryId.setValue(TEST_CATEGORIES.shopping.id);
    component.onSubmit();

    expect(submitted).toEqual([{ keyword: 'METRO', categoryId: TEST_CATEGORIES.shopping.id }]);
  });

  it('needs a keyword of at most 100 characters', async () => {
    create(null);
    component.form.controls.keyword.setValue('   ');
    component.onSubmit();
    component.form.controls.keyword.setValue('X'.repeat(101));
    component.onSubmit();
    await fixture.whenStable();

    expect(submitted).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('At most 100 characters.');
  });
});
