import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TimelinePageComponent } from './timeline-page.component';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { testEntry, testTimeline } from '../../../testing/test-timeline';

describe('TimelinePageComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = (el: Element) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  async function start(url = '/timeline'): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'timeline', component: TimelinePageComponent },
          { path: '**', children: [] },
        ]),
        provideLocationMocks(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, TimelinePageComponent);
  }

  function answer(page = testTimeline()) {
    const request = http.expectOne((r) => r.url === '/api/timeline');
    request.flush(page);
    return request.request;
  }

  afterEach(() => http.verify());

  it('shows the days, newest first, with their entries, and the first page is 14 days', async () => {
    await start();
    TestBed.tick();
    const request = answer();
    await settle();

    expect(request.params.get('days')).toBe('14');
    expect(request.params.has('before')).toBe(false);
    expect(request.params.has('module')).toBe(false);
    expect(Array.from(root().querySelectorAll('.day-heading')).map(text)).toEqual([
      'TODAY · SAT OCT 10',
      'YESTERDAY · FRI OCT 9',
    ]);
    const today = Array.from(root().querySelectorAll('[data-day="2026-10-10"] .entry-card')).map(
      text,
    );
    expect(today).toEqual([
      'COSTCO -$142.18 Groceries · CIBC Visa',
      'Journal Finished the handouts.',
    ]);
    const document = root().querySelector('[data-entry="documents.document-added.d1"]')!;
    expect(document.querySelector('a')!.getAttribute('href')).toBe('/documents/d1');
    expect(document.querySelector('.entry-icon')!.getAttribute('data-tone')).toBe('documents');
    expect(text(document)).toMatch(/Car insurance policy \d\d:\d\d · Insurance/);
  });

  it('opens an entry with its query through the router', async () => {
    await start();
    TestBed.tick();
    answer();
    await settle();

    (root().querySelector('[data-entry="money.transaction.t1"] a') as HTMLAnchorElement).click();
    await settle();

    expect(TestBed.inject(Router).url).toBe('/money/transactions?id=t1');
  });

  it('leaves a Ctrl or Cmd click on an entry to the browser, for a new tab', async () => {
    await start();
    TestBed.tick();
    answer();
    await settle();

    const link = root().querySelector('[data-entry="money.transaction.t1"] a') as HTMLAnchorElement;
    let handled = true;
    // Seen after the page's own handler; then cancelled, so the test browser stays on its page.
    const record = (event: Event) => {
      handled = event.defaultPrevented;
      event.preventDefault();
    };
    root().addEventListener('click', record);
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
    root().removeEventListener('click', record);
    await settle();

    expect(handled).toBe(false);
    expect(TestBed.inject(Router).url).toBe('/timeline');
  });

  it('filters by module through the address, and loads earlier days', async () => {
    await start('/timeline?module=money');
    TestBed.tick();
    expect(
      answer(testTimeline({ days: [{ day: '2026-10-10', entries: [testEntry()] }] })).params.get(
        'module',
      ),
    ).toBe('Money');
    await settle();
    expect(text(root().querySelector('[aria-current="page"]')!)).toBe('Money');

    (root().querySelector('[data-testid="earlier"]') as HTMLButtonElement).click();
    const earlier = answer(
      testTimeline({
        from: '2026-09-13',
        to: '2026-09-26',
        earlier: '2026-09-13',
        hasEarlier: false,
        days: [
          {
            day: '2026-09-20',
            entries: [
              testEntry({
                id: 'money.transaction.t2',
                day: '2026-09-20',
                title: 'PAYROLL',
                amount: 2400,
              }),
            ],
          },
        ],
      }),
    );
    expect(earlier.params.get('before')).toBe('2026-09-27');
    expect(earlier.params.get('module')).toBe('Money');
    await settle();
    expect(Array.from(root().querySelectorAll('.day-heading')).map(text)).toEqual([
      'TODAY · SAT OCT 10',
      'SUN SEP 20',
    ]);
    expect(
      root().querySelector('[data-entry="money.transaction.t2"] .amount')!.classList,
    ).toContain('text-success');
    // Nothing earlier in any module: no "Show earlier" (it went on through empty weeks for ever).
    expect(root().querySelector('[data-testid="earlier"]')).toBeNull();
    expect(text(root().querySelector('[data-testid="start"]')!)).toBe(
      'That is everything: nothing happened earlier.',
    );
  });

  it('says which module failed, and loads again after a change in any module', async () => {
    await start();
    TestBed.tick();
    answer(
      testTimeline({
        modules: [
          { module: 'Money', status: 'Failed' },
          { module: 'Journal', status: 'Complete' },
        ],
      }),
    );
    await settle();
    expect(text(root().querySelector('[data-testid="failed"]')!)).toContain(
      'Money could not load.',
    );

    TestBed.inject(DataChangesService).changed();
    TestBed.tick();
    answer();
    await settle();
    expect(root().querySelector('[data-testid="failed"]')).toBeNull();
  });

  it('shows an error with a retry when the first page fails', async () => {
    await start();
    TestBed.tick();
    http
      .expectOne((r) => r.url === '/api/timeline')
      .flush(null, { status: 500, statusText: 'Error' });
    await settle();

    expect(root().textContent).toContain('Could not load the timeline.');
    root().querySelector<HTMLButtonElement>('app-error-state button')!.click();
    answer(testTimeline({ days: [] }));
    await settle();
    expect(text(root().querySelector('[data-testid="empty"]')!)).toBe(
      'Nothing happened in these days.',
    );
  });
});
