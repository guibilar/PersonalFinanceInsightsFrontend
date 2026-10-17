import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { ReviewComponent } from './review.component';
import { TEST_REVIEW } from '../../testing/test-insights';
import { TEST_CATEGORIES } from '../../testing/test-categories';

describe('ReviewComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 4, 12));
    TestBed.configureTestingModule({
      imports: [ReviewComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'review', component: ReviewComponent }]),
        provideLocationMocks(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();

  async function load() {
    const fixture = TestBed.createComponent(ReviewComponent);
    TestBed.tick();
    http.expectOne('/api/Reports/review').flush(TEST_REVIEW);
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('opens on the last complete month, against the month before', async () => {
    const { root } = await load();

    const stats = Array.from(root.querySelectorAll('app-stat-card')).map(text);
    expect(stats[0]).toContain('$1,315.00');
    expect(stats[0]).toContain('about the same as August 2026');
    expect(stats[1]).toContain('Left over $1,685.00');
    expect(stats[2]).toContain('26 days without one');
    expect(text(root.querySelector('[aria-live]')!)).toBe('September 2026');
  });

  it('names what changed most, and the biggest purchase', async () => {
    const { root } = await load();

    expect(text(root)).toContain('Dining+$15.00');
    expect(text(root)).toContain('Groceries−$10.00');
    expect(text(root)).toContain('$1,000.00 at LANDLORD');
  });

  it('gives a category whose refunds outweigh its spending an empty bar, not a full one', async () => {
    const fixture = TestBed.createComponent(ReviewComponent);
    TestBed.tick();
    http.expectOne('/api/Reports/review').flush({
      ...TEST_REVIEW,
      categories: [
        { category: TEST_CATEGORIES.rent, spending: 1000, previousSpending: 1000 },
        { category: TEST_CATEGORIES.dining, spending: -40, previousSpending: 500 },
      ],
    });
    await fixture.whenStable();

    const widths = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.bar-track .bar'),
    ).map((bar) => bar.style.width);
    expect(widths).toEqual(['100%', '100%', '0%', '50%']);
  });

  it('steps to the month before, but not past the running one', async () => {
    const { fixture, root } = await load();
    const [previous, next] = Array.from(
      root.querySelectorAll<HTMLButtonElement>('button[aria-label$="month"]'),
    );
    expect(next.disabled).toBe(false);

    previous.click();
    TestBed.tick();
    const request = http.expectOne((r) => r.url === '/api/Reports/review');
    expect(request.request.params.get('year')).toBe('2026');
    expect(request.request.params.get('month')).toBe('8');
    request.flush({ ...TEST_REVIEW, label: 'August 2026', month: 8 });
    await fixture.whenStable();
  });

  it('switches to the year', async () => {
    const { root } = await load();

    Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => text(b) === 'Year')!
      .click();
    TestBed.tick();
    const request = http.expectOne((r) => r.url === '/api/Reports/review');
    expect(request.request.params.get('year')).toBe('2026');
    expect(request.request.params.has('month')).toBe(false);
    request.flush({ ...TEST_REVIEW, label: '2026', month: null });
  });
  it('goes back to the last complete month from the menu’s link, while open on another', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/review?year=2025&month=3', ReviewComponent);
    TestBed.tick();
    const first = http.expectOne((r) => r.url === '/api/Reports/review');
    expect(first.request.params.get('month')).toBe('3');
    first.flush({ ...TEST_REVIEW, label: 'March 2025', year: 2025, month: 3 });

    await harness.navigateByUrl('/review');
    TestBed.tick();
    const request = http.expectOne((r) => r.url === '/api/Reports/review');
    expect(request.request.params.keys()).toEqual([]);
    request.flush(TEST_REVIEW);
  });
});
