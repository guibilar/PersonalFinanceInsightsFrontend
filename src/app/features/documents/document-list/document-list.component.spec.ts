import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { DocumentListComponent } from './document-list.component';
import { DocumentSummaryDto } from '../../../core/models/outputs/document-output-dto';
import { isoDay } from '../../../shared/utils/date-presets';
import { DOC_ID, testPage, testSummary } from '../../../testing/test-documents';
import { signInAsReadOnly } from '../../../testing/test-auth';

describe('DocumentListComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let router: Router;

  const root = () => harness.routeNativeElement as HTMLElement;
  const text = (el: Element) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();
  const rows = (testId: string) =>
    Array.from(root().querySelectorAll(`[data-testid="${testId}"] li`)).map(text);

  /** The two list requests: the expiring ones (with expiring=soon) and the page. */
  function pending(): { page?: TestRequest; expiring?: TestRequest } {
    TestBed.tick();
    const requests = http.match((r) => r.url === '/api/documents');
    return {
      page: requests.find((r) => !r.request.params.has('expiring')),
      expiring: requests.find((r) => r.request.params.has('expiring')),
    };
  }

  async function answer(
    items: DocumentSummaryDto[] = [],
    expiring: DocumentSummaryDto[] = [],
    totalCount = items.length,
  ): Promise<{ page?: TestRequest; expiring?: TestRequest }> {
    const requests = pending();
    const page = Number(requests.page?.request.params.get('page') ?? 1);
    requests.page?.flush(testPage(items, page, totalCount));
    requests.expiring?.flush(testPage(expiring));
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
    return requests;
  }

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  }

  function addDays(days: number): string {
    const day = new Date();
    day.setDate(day.getDate() + days);
    return isoDay(day);
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'documents', component: DocumentListComponent },
          { path: 'documents/:id', children: [] },
        ]),
        provideLocationMocks(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  it('lists the documents, newest first, with their kind, tags, OCR state and a link to each', async () => {
    await harness.navigateByUrl('/documents', DocumentListComponent);
    const { page, expiring } = await answer([
      testSummary({ ocrStatus: 'Pending', expiresOn: null }),
      testSummary({
        id: 'd2',
        title: 'T4 slip 2025',
        kind: 'Tax',
        tags: [],
        issuedOn: '2026-02-20',
        ocrStatus: 'Failed',
        expiresOn: null,
        links: [{ id: 'l1', kind: 'Money.Transaction', targetId: 't', createdAt: '' }],
      }),
    ]);

    expect(page!.request.params.get('page')).toBe('1');
    expect(page!.request.params.get('pageSize')).toBe('20');
    expect(page!.request.params.has('kind')).toBe(false);
    // The server's today decides the window (T86), not the browser's.
    expect(expiring!.request.params.get('expiring')).toBe('soon');
    expect(expiring!.request.params.has('expiresFrom')).toBe(false);

    expect(rows('documents')).toEqual([
      'Dishwasher warranty Warranty · Nov 9, 2024 · 2 files #kitchen #appliances Reading text…',
      'T4 slip 2025 Tax · Feb 20, 2026 · 2 files · Linked Text not read',
    ]);
    const links = Array.from(root().querySelectorAll('[data-testid="documents"] a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      `/documents/${DOC_ID}`,
      '/documents/d2',
    ]);
    expect(root().querySelector('[data-ocr="Failed"]')!.classList).toContain('text-bg-danger');
  });

  it('has no "Add document" for a read-only user', async () => {
    await harness.navigateByUrl('/documents', DocumentListComponent);
    await answer([testSummary()]);
    expect(root().querySelector('a[href="/documents/new"]')).not.toBeNull();

    await signInAsReadOnly(http);
    harness.fixture.detectChanges();

    expect(root().querySelector('a[href="/documents/new"]')).toBeNull();
    expect(rows('documents').length).toBe(1);
  });

  it('shows the ones that expire in the next 30 days, soonest first, with the days left', async () => {
    await harness.navigateByUrl('/documents', DocumentListComponent);
    await answer(
      [testSummary()],
      [
        testSummary({
          id: 'lease',
          title: 'Apartment lease',
          kind: 'Lease',
          expiresOn: addDays(22),
        }),
        testSummary({
          id: 'car',
          title: 'Car insurance',
          kind: 'Insurance',
          expiresOn: addDays(3),
        }),
      ],
    );

    const soon = rows('expire-soon');
    expect(soon.length).toBe(2);
    expect(soon[0]).toContain('Car insurance');
    expect(soon[0]).toContain('In 3 days');
    expect(soon[1]).toContain('Apartment lease');
    expect(soon[1]).toContain('In 22 days');
    expect(root().querySelector('[data-testid="expire-soon"] a')!.getAttribute('href')).toBe(
      '/documents/car',
    );
  });

  it('filters by kind through the address, and back to All', async () => {
    await harness.navigateByUrl('/documents', DocumentListComponent);
    await answer([testSummary()]);

    const chip = (label: string) =>
      Array.from(root().querySelectorAll<HTMLButtonElement>('.kind-chip')).find(
        (b) => b.textContent!.trim() === label,
      )!;
    expect(chip('All').getAttribute('aria-pressed')).toBe('true');

    chip('Warranties').click();
    await settle();
    expect(router.url).toBe('/documents?kind=Warranty');
    const { page, expiring } = await answer([testSummary()]);
    expect(page!.request.params.get('kind')).toBe('Warranty');
    expect(expiring!.request.params.get('kind')).toBe('Warranty');
    expect(chip('Warranties').getAttribute('aria-pressed')).toBe('true');
    expect(root().querySelector('#all-heading')!.textContent!.trim()).toBe('Warranties');

    chip('All').click();
    await settle();
    expect(router.url).toBe('/documents');
    await answer([testSummary()]);
  });

  it('searches after a pause in the typing, best match first, without the expire-soon list', async () => {
    await harness.navigateByUrl('/documents', DocumentListComponent);
    await answer([testSummary()], [testSummary({ expiresOn: addDays(5) })]);
    expect(root().querySelector('[data-testid="expire-soon"]')).not.toBeNull();

    const input = root().querySelector<HTMLInputElement>('#document-search')!;
    input.value = ' kettle ';
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 400));
    await settle();

    expect(router.url).toBe('/documents?q=kettle');
    const { page, expiring } = await answer([]);
    expect(page!.request.params.get('q')).toBe('kettle');
    expect(expiring).toBeUndefined();
    expect(root().querySelector('[data-testid="expire-soon"]')).toBeNull();
    expect(root().textContent).toContain('No document matches “kettle”.');
  });

  it('starts from the filters in the address, and pages', async () => {
    await harness.navigateByUrl('/documents?kind=Receipt&q=costco&page=2', DocumentListComponent);
    const { page } = await answer(
      Array.from({ length: 20 }, (_, i) => testSummary({ id: `d${i}`, title: `Receipt ${i}` })),
      [],
      45,
    );
    expect(page!.request.params.get('kind')).toBe('Receipt');
    expect(page!.request.params.get('q')).toBe('costco');
    expect(page!.request.params.get('page')).toBe('2');
    expect(root().querySelector<HTMLInputElement>('#document-search')!.value).toBe('costco');

    Array.from(root().querySelectorAll<HTMLButtonElement>('.page-link'))
      .find((b) => b.textContent!.trim() === 'Next')!
      .click();
    await settle();
    expect(router.url).toBe('/documents?kind=Receipt&q=costco&page=3');
    await answer([testSummary()], [], 45);
  });

  it('says how to start when there are no documents', async () => {
    await harness.navigateByUrl('/documents', DocumentListComponent);
    await answer([]);

    expect(root().textContent).toContain('No documents yet.');
    expect(root().querySelector('a[href="/documents/new"]')!.textContent).toContain('Add document');
  });

  it('shows an error with a retry when the list does not load', async () => {
    await harness.navigateByUrl('/documents', DocumentListComponent);
    const requests = pending();
    requests.page!.flush(null, { status: 502, statusText: 'Bad Gateway' });
    requests.expiring!.flush(testPage([]));
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();

    expect(root().textContent).toContain('Could not load the documents.');
    root().querySelector<HTMLButtonElement>('app-error-state button')!.click();
    await answer([testSummary()]);
    expect(rows('documents').length).toBe(1);
  });
});
