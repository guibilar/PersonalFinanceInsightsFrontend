import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { SearchPageComponent } from './search-page.component';
import { SearchDto, SearchHit } from '../../core/models/outputs/search-output-dto';

function hit(changes: Partial<SearchHit>): SearchHit {
  return {
    id: 'home.item.i1',
    module: 'Home',
    kind: 'item',
    title: 'Dishwasher',
    text: 'Kitchen',
    day: null,
    amount: null,
    link: '/home/items/i1',
    ...changes,
  };
}

function answer(changes: Partial<SearchDto> = {}): SearchDto {
  return {
    query: 'dishwasher',
    total: 9,
    modules: [
      {
        module: 'Money',
        status: 'Complete',
        total: 1,
        hits: [
          hit({
            id: 'money.transaction.t1',
            module: 'Money',
            kind: 'transaction',
            title: 'Home Depot',
            text: 'Household · CIBC Visa',
            day: '2025-09-08',
            amount: -899,
            link: '/money/transactions?id=t1',
          }),
        ],
      },
      { module: 'Documents', status: 'Complete', total: 0, hits: [] },
      {
        module: 'Tasks',
        status: 'Complete',
        total: 7,
        hits: [
          hit({
            id: 'tasks.task.k1',
            module: 'Tasks',
            kind: 'task',
            title: 'Clean the dishwasher filter',
            text: 'Open',
            link: '/tasks/k1',
          }),
        ],
      },
      { module: 'Home', status: 'Complete', total: 1, hits: [hit({})] },
      { module: 'People', status: 'Failed', total: 0, hits: [] },
    ],
    ...changes,
  };
}

describe('SearchPageComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = (el: Element) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  async function start(url = '/search'): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'search', component: SearchPageComponent },
          { path: '**', children: [] },
        ]),
        provideLocationMocks(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, SearchPageComponent);
    TestBed.tick();
  }

  afterEach(() => http.verify());

  it('asks for two characters, then searches after a pause, with the text in the address', async () => {
    await start();
    expect(root().querySelector('[data-testid="hint"]')).not.toBeNull();

    const input = root().querySelector<HTMLInputElement>('#search-everything')!;
    input.value = '  dishwasher ';
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();

    expect(TestBed.inject(Router).url).toBe('/search?q=dishwasher');
    const request = http.expectOne((r) => r.url === '/api/search');
    expect(request.request.params.get('q')).toBe('dishwasher');
    expect(request.request.params.has('module')).toBe(false);
    request.flush(answer());
    await settle();

    expect(text(root().querySelector('[data-testid="summary"]')!)).toBe('9 results in 3 modules');
    expect(Array.from(root().querySelectorAll('.section-title')).map(text)).toEqual([
      'TRANSACTIONS',
      'TASKS',
      'ITEMS',
    ]);
    expect(text(root().querySelector('[data-module="Money"] .hit')!)).toBe(
      'Home Depot Sep 8, 2025 · Household · CIBC Visa -$899.00',
    );
    expect(text(root().querySelector('[data-testid="failed"]')!)).toBe('People could not search.');
  });

  it('shows all of one module, and opens a hit with its query through the router', async () => {
    await start('/search?q=dishwasher');
    http.expectOne((r) => r.url === '/api/search').flush(answer());
    await settle();

    (root().querySelector('[data-more="Tasks"]') as HTMLAnchorElement).click();
    await settle();
    expect(TestBed.inject(Router).url).toBe('/search?q=dishwasher&module=Tasks');
    const more = http.expectOne((r) => r.url === '/api/search');
    expect(more.request.params.get('module')).toBe('Tasks');
    more.flush(answer({ total: 7, modules: [answer().modules[2]] }));
    await settle();
    expect(text(root().querySelector('[data-testid="module"]')!)).toContain('Only Tasks.');
    expect(root().querySelector('[data-more]')).toBeNull();

    (root().querySelector('[data-module="Tasks"] .hit') as HTMLAnchorElement).click();
    await settle();
    expect(TestBed.inject(Router).url).toBe('/tasks/k1');
  });

  it('says when nothing matches, and offers a retry after an error', async () => {
    await start('/search?q=zzz');
    http
      .expectOne((r) => r.url === '/api/search')
      .flush(null, { status: 500, statusText: 'Error' });
    await settle();
    root().querySelector<HTMLButtonElement>('app-error-state button')!.click();
    await settle();
    http
      .expectOne((r) => r.url === '/api/search')
      .flush(
        answer({
          query: 'zzz',
          total: 0,
          modules: [{ module: 'Money', status: 'Complete', total: 0, hits: [] }],
        }),
      );
    await settle();

    expect(text(root().querySelector('[data-testid="summary"]')!)).toBe('No results for “zzz”.');
  });
});
