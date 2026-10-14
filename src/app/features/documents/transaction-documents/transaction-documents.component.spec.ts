import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TransactionDocumentsComponent } from './transaction-documents.component';
import { DocumentSummaryDto } from '../../../core/models/outputs/document-output-dto';
import { DOC_ID, TX_ID, testPage, testSummary } from '../../../testing/test-documents';
import { signInAsReadOnly } from '../../../testing/test-auth';

const RECEIPT_ID = '0199f1a0-4444-7000-8000-000000000004';

describe('TransactionDocumentsComponent', () => {
  let fixture: ComponentFixture<TransactionDocumentsComponent>;
  let http: HttpTestingController;

  const root = () => fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent!.trim() === label,
    );
  const receipt = testSummary({
    id: RECEIPT_ID,
    title: 'Costco receipt',
    kind: 'Receipt',
    files: [testSummary().files[0]],
  });

  async function render(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    fixture.detectChanges();
  }

  function byLink(): TestRequest {
    TestBed.tick();
    return http.expectOne((r) => r.method === 'GET' && r.url === '/api/documents/by-link');
  }

  function candidates(): TestRequest {
    TestBed.tick();
    return http.expectOne((r) => r.method === 'GET' && r.url === '/api/documents');
  }

  async function open(documents: DocumentSummaryDto[]): Promise<void> {
    const request = byLink();
    expect(request.request.params.get('kind')).toBe('Money.Transaction');
    expect(request.request.params.get('id')).toBe(TX_ID);
    request.flush(documents);
    await render();
  }

  async function startLinking(items: DocumentSummaryDto[]): Promise<void> {
    button('Link an existing document')!.click();
    await render();
    const request = candidates();
    expect(request.request.params.get('pageSize')).toBe('5');
    expect(request.request.params.has('q')).toBe(false);
    request.flush(testPage(items));
    await render();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TransactionDocumentsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(TransactionDocumentsComponent);
    fixture.componentRef.setInput('transactionId', TX_ID);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('lists the linked documents, each opening its page', async () => {
    await open([receipt, testSummary()]);

    const rows = Array.from(
      root().querySelectorAll<HTMLAnchorElement>('[data-testid="transaction-documents"] a'),
    );
    expect(rows.map((a) => a.querySelector('.fw-medium')!.textContent!.trim())).toEqual([
      'Costco receipt',
      'Dishwasher warranty',
    ]);
    expect(rows.map((a) => a.querySelector('.small')!.textContent!.trim())).toEqual([
      'Receipt · 1 file',
      'Warranty · 2 files',
    ]);
    expect(rows[0].getAttribute('href')).toBe(`/documents/${RECEIPT_ID}`);
    expect(rows[1].getAttribute('href')).toBe(`/documents/${DOC_ID}`);
  });

  it('says so when the transaction has no documents, and offers to add one', async () => {
    await open([]);

    expect(root().querySelector('[data-testid="no-documents"]')).not.toBeNull();
    const add = Array.from(root().querySelectorAll<HTMLAnchorElement>('a')).find(
      (a) => a.textContent!.trim() === 'Add document',
    )!;
    expect(add.getAttribute('href')).toBe(`/documents/new?transactionId=${TX_ID}`);
  });

  it('shows a failed load with a retry', async () => {
    byLink().flush(null, { status: 500, statusText: 'Server Error' });
    await render();

    expect(root().textContent).toContain('Could not load the documents.');
    button('Retry')!.click();
    await open([receipt]);
    expect(root().querySelectorAll('[data-testid="transaction-documents"] li').length).toBe(1);
  });

  it('links an existing document from a search, then lists it', async () => {
    await open([receipt]);
    await startLinking([receipt, testSummary()]);

    const linked = root().querySelector<HTMLButtonElement>(
      'button[aria-label="Link Costco receipt"]',
    )!;
    expect(linked.textContent!.trim()).toBe('Linked');
    expect(linked.disabled).toBe(true);

    const input = root().querySelector<HTMLInputElement>('#transaction-documents-search')!;
    input.value = ' warranty ';
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 350));
    const search = candidates();
    expect(search.request.params.get('q')).toBe('warranty');
    search.flush(testPage([testSummary()]));
    await render();

    root()
      .querySelector<HTMLButtonElement>('button[aria-label="Link Dishwasher warranty"]')!
      .click();
    const link = http.expectOne({ method: 'POST', url: `/api/documents/${DOC_ID}/links` });
    expect(link.request.body).toEqual({ kind: 'Money.Transaction', targetId: TX_ID });
    link.flush({ id: 'l1', kind: 'Money.Transaction', targetId: TX_ID, createdAt: '' });
    await render();

    await open([testSummary(), receipt]);
    expect(root().querySelector('#transaction-documents-search')).toBeNull();
    expect(root().querySelectorAll('[data-testid="transaction-documents"] li').length).toBe(2);
    expect(root().textContent).toContain('Linked “Dishwasher warranty”.');
  });

  it('takes a link that exists already as done', async () => {
    await open([]);
    await startLinking([testSummary()]);

    button('Link')!.click();
    http
      .expectOne({ method: 'POST', url: `/api/documents/${DOC_ID}/links` })
      .flush(
        { title: 'The document has this link already.' },
        { status: 409, statusText: 'Conflict' },
      );
    await render();

    await open([testSummary()]);
    expect(root().querySelector('[data-testid="link-error"]')).toBeNull();
  });

  it('shows why a link failed, and keeps the search open', async () => {
    await open([]);
    await startLinking([testSummary()]);

    button('Link')!.click();
    http
      .expectOne({ method: 'POST', url: `/api/documents/${DOC_ID}/links` })
      .flush(null, { status: 502, statusText: 'Bad Gateway' });
    await render();

    expect(root().querySelector('[data-testid="link-error"]')!.textContent).toContain(
      'The server could not check with Money.',
    );
    expect(root().querySelector('#transaction-documents-search')).not.toBeNull();
  });

  it('hides the add and link actions after the server says the account can only read', async () => {
    await open([receipt]);
    await startLinking([testSummary()]);

    button('Link')!.click();
    http
      .expectOne({ method: 'POST', url: `/api/documents/${DOC_ID}/links` })
      .flush(null, { status: 403, statusText: 'Forbidden' });
    await render();

    expect(root().querySelector('[data-testid="read-only"]')!.textContent).toContain(
      'This account can only read documents.',
    );
    expect(button('Link an existing document')).toBeUndefined();
    expect(root().textContent).not.toContain('Add document');
    // The documents stay.
    expect(root().querySelectorAll('[data-testid="transaction-documents"] li').length).toBe(1);
  });

  it('shows a read-only user no add or link actions, from the start', async () => {
    await signInAsReadOnly(http);
    await open([receipt]);

    expect(root().querySelector('[data-testid="read-only"]')!.textContent).toContain(
      'This account can only read documents.',
    );
    expect(button('Link an existing document')).toBeUndefined();
    expect(root().textContent).not.toContain('Add document');
    expect(root().querySelectorAll('[data-testid="transaction-documents"] li').length).toBe(1);
  });
});
