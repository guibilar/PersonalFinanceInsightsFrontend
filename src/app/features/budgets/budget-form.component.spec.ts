import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BudgetFormComponent } from './budget-form.component';
import { BudgetInputDto } from '../../core/models/inputs/budget-input-dto';
import { BudgetOutputDto } from '../../core/models/outputs/budget-output-dto';
import { Status } from '../../core/models/enums/status';

describe('BudgetFormComponent', () => {
  let fixture: ComponentFixture<BudgetFormComponent>;
  let component: BudgetFormComponent;
  let submitted: BudgetInputDto[];

  function create(budget: BudgetOutputDto | null = null) {
    TestBed.configureTestingModule({
      imports: [BudgetFormComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(BudgetFormComponent);
    fixture.componentRef.setInput('budget', budget);
    component = fixture.componentInstance;
    submitted = [];
    component.submitBudget.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
  }

  it('starts invalid and does not submit', () => {
    create();

    component.onSubmit();

    expect(component.form.invalid).toBeTrue();
    expect(submitted).toEqual([]);
  });

  it('rejects blank text and non-positive amounts', () => {
    create();

    component.form.setValue({ name: '   ', description: 'Food', amount: 0, status: Status.Active });

    expect(component.form.controls.name.invalid).toBeTrue();
    expect(component.form.controls.amount.invalid).toBeTrue();
  });

  it('emits a trimmed DTO for a new budget', () => {
    create();

    component.form.setValue({
      name: ' Food ',
      description: ' Groceries ',
      amount: 300,
      status: Status.Inactive,
    });
    component.onSubmit();

    expect(submitted).toEqual([
      { id: '', name: 'Food', description: 'Groceries', amount: 300, status: Status.Inactive },
    ]);
  });

  it('prefills and keeps the id when editing', () => {
    create({
      id: 'b1',
      name: 'Food',
      description: 'Groceries',
      status: Status.Inactive,
      totalAmount: 500,
      totalSpent: 0,
      totalRemaining: 500,
      percentageUsed: 0,
    });

    expect(component.isEditing()).toBeTrue();
    expect(component.form.getRawValue()).toEqual({
      name: 'Food',
      description: 'Groceries',
      amount: 500,
      status: Status.Inactive,
    });

    component.onSubmit();
    expect(submitted[0].id).toBe('b1');
  });
});
