import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryAveragesComponent } from './category-averages.component';
import { CategorizedReportOutputDto } from '../../../core/models/outputs/categorized-report-output-dto';
import { categoryRefs } from '../../../testing/test-categories';

const year: CategorizedReportOutputDto = {
  categories: categoryRefs('Dining', 'Groceries'),
  averageMonthlyTotal: 0,
  monthlyData: [
    { month: 'Jul 2026', total: 400, categoryValues: { Dining: 100, Groceries: 300 } },
    { month: 'Aug 2026', total: 500, categoryValues: { Dining: 200, Groceries: 300 } },
    { month: 'Sep 2026', total: 375, categoryValues: { Dining: 375 } },
  ],
};

describe('CategoryAveragesComponent', () => {
  let fixture: ComponentFixture<CategoryAveragesComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CategoryAveragesComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(CategoryAveragesComponent);
    fixture.componentRef.setInput('report', year);
    fixture.componentRef.setInput('today', new Date(2026, 8, 5));
    await fixture.whenStable();
  });

  it('lists the categories by average, each with this month next to it', () => {
    const rows = Array.from(root().querySelectorAll('li')).map((li) =>
      li.textContent!.replace(/\s+/g, ' ').trim(),
    );

    expect(rows).toEqual([
      'Groceries$300.00 / month$0.00 this month −100% vs average',
      'Dining$150.00 / month$375.00 this month +150% vs average',
    ]);
    expect(root().textContent).toContain('Over 2 finished months');
    expect(root().textContent).toContain('September so far');
  });

  it('draws both bars on one scale, and describes them for screen readers', () => {
    const bars = Array.from(root().querySelectorAll<HTMLElement>('li:nth-child(2) .progress-bar'));

    // Dining: the average of 150 and this month's 375, against the largest value on show (375).
    expect(bars.map((bar) => Math.round(parseFloat(bar.style.width)))).toEqual([40, 100]);
    expect(root().querySelector('li:nth-child(2) [role=img]')!.getAttribute('aria-label')).toBe(
      'Dining: average $150.00 a month, $375.00 this month',
    );
  });
});
