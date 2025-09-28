import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonthlySpendingStackedBarChart } from './monthly-spending-stacked-bar-chart';

describe('MonthlySpendingStackedBarChart', () => {
  let component: MonthlySpendingStackedBarChart;
  let fixture: ComponentFixture<MonthlySpendingStackedBarChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthlySpendingStackedBarChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MonthlySpendingStackedBarChart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
