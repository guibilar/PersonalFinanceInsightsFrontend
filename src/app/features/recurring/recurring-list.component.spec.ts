import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RecurringListComponent } from './recurring-list.component';
import { TEST_RECURRING } from '../../testing/test-insights';

describe('RecurringListComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RecurringListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function load(report = TEST_RECURRING): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(RecurringListComponent);
    TestBed.tick();
    http.expectOne('/api/Reports/recurring').flush(report);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();

  it('totals what still comes, and flags a price that went up', async () => {
    const root = await load();

    const stats = Array.from(root.querySelectorAll('app-stat-card')).map(text);
    expect(stats[0]).toContain('$1,018.99');
    expect(stats[0]).toContain('2 recurring payments');
    expect(stats[1]).toContain('$12,227.88');
    expect(stats[2]).toContain('NETFLIX went up');

    const rows = Array.from(root.querySelectorAll('.card li')).map(text);
    expect(rows[0]).toContain('LANDLORD');
    expect(rows[0]).toContain('every month · next Oct 20');
    expect(rows[1]).toContain('NETFLIX Up from $16.49');
  });

  it('lists the stopped ones apart, with their last charge', async () => {
    const root = await load();

    const headings = Array.from(root.querySelectorAll('h2')).map(text);
    expect(headings).toContain('Stopped');
    const stopped = Array.from(root.querySelectorAll('li'))
      .map(text)
      .find((r) => r.includes('GYM'))!;
    expect(stopped).toContain('Stopped');
    expect(stopped).toContain('last May 3');
  });

  it('links each to its transactions', async () => {
    const root = await load();

    const link = root.querySelector<HTMLAnchorElement>('li a')!;
    expect(link.getAttribute('href')).toBe('/money/transactions?description=LANDLORD');
  });

  it('explains when none were found', async () => {
    const root = await load({ payments: [], monthlyTotal: 0, yearlyTotal: 0 });

    expect(text(root)).toContain('No recurring payments found yet.');
  });
});
