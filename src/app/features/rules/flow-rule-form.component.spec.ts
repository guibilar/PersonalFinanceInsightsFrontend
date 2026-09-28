import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlowRuleFormComponent } from './flow-rule-form.component';
import { Flow } from '../../core/models/enums/flow';
import { FlowRuleInputDto } from '../../core/models/inputs/flow-rule-input-dto';
import { FlowRuleOutputDto } from '../../core/models/outputs/flow-rule-output-dto';

describe('FlowRuleFormComponent', () => {
  let fixture: ComponentFixture<FlowRuleFormComponent>;
  let component: FlowRuleFormComponent;
  let submitted: FlowRuleInputDto[];

  const root = () => fixture.nativeElement as HTMLElement;

  function create(rule: FlowRuleOutputDto | null) {
    TestBed.configureTestingModule({
      imports: [FlowRuleFormComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(FlowRuleFormComponent);
    fixture.componentRef.setInput('rule', rule);
    component = fixture.componentInstance;
    submitted = [];
    component.submitRule.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
  }

  it('adds a rule with a trimmed keyword', () => {
    create(null);
    component.form.patchValue({ keyword: '  payroll ', flow: Flow.Income });

    component.onSubmit();

    expect(submitted).toEqual([{ keyword: 'payroll', flow: Flow.Income }]);
  });

  it('offers every flow but Spending, and says what the chosen one does', async () => {
    create(null);

    const options = Array.from(root().querySelectorAll('#flow-rule-flow option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(options).toEqual(['Refund', 'Income', 'Transfer', 'Ignored']);

    component.form.controls.flow.setValue(Flow.Income);
    await fixture.whenStable();
    expect(root().querySelector('#flow-rule-flow-hint')!.textContent).toContain(
      'Applies to money in only.',
    );
  });

  it('edits a rule', () => {
    create({ id: 'f1', keyword: 'PAYMENT THANK YOU', flow: Flow.Transfer });

    expect(component.form.controls.keyword.value).toBe('PAYMENT THANK YOU');
    component.form.controls.flow.setValue(Flow.Ignored);
    component.onSubmit();

    expect(submitted).toEqual([{ keyword: 'PAYMENT THANK YOU', flow: Flow.Ignored }]);
  });

  it('needs a keyword of at most 100 characters', async () => {
    create(null);
    component.form.controls.keyword.setValue('   ');
    component.onSubmit();
    component.form.controls.keyword.setValue('X'.repeat(101));
    component.onSubmit();
    await fixture.whenStable();

    expect(submitted).toEqual([]);
    expect(root().textContent).toContain('At most 100 characters.');
  });
});
