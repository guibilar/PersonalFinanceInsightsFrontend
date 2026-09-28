import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RuleFormComponent } from './rule-form.component';
import { Category } from '../../core/models/enums/category';
import { CategoryRuleInputDto } from '../../core/models/inputs/category-rule-input-dto';

describe('RuleFormComponent', () => {
  let fixture: ComponentFixture<RuleFormComponent>;
  let component: RuleFormComponent;
  let submitted: CategoryRuleInputDto[];

  function create(
    rule: { id: string; keyword: string; category: Category; position: number } | null,
  ) {
    TestBed.configureTestingModule({
      imports: [RuleFormComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(RuleFormComponent);
    fixture.componentRef.setInput('rule', rule);
    component = fixture.componentInstance;
    submitted = [];
    component.submitRule.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
  }

  it('adds a new rule first by default, with a trimmed keyword', () => {
    create(null);
    component.form.patchValue({ keyword: '  corner store ', category: Category.Groceries });

    component.onSubmit();

    expect(submitted).toEqual([
      { keyword: 'corner store', category: Category.Groceries, position: 0 },
    ]);
  });

  it('can add it last instead', () => {
    create(null);
    component.form.patchValue({ keyword: 'BAKERY', category: Category.Dining, placement: 'last' });

    component.onSubmit();

    expect(submitted).toEqual([{ keyword: 'BAKERY', category: Category.Dining }]);
  });

  it('edits a rule without the order choice', () => {
    create({ id: 'r1', keyword: 'METRO', category: Category.Groceries, position: 4 });
    const root = fixture.nativeElement as HTMLElement;

    expect(component.form.controls.keyword.value).toBe('METRO');
    expect(root.querySelector('#rule-placement-first')).toBeNull();
    component.form.controls.category.setValue(Category.Shopping);
    component.onSubmit();

    expect(submitted).toEqual([{ keyword: 'METRO', category: Category.Shopping }]);
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
