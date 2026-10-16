import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DocumentSuggestionsComponent, hasSuggestions } from './document-suggestions.component';
import { TransactionAddLauncher } from '../../../core/data/transaction-add-launcher.service';
import {
  DocumentDto,
  DocumentSuggestionsDto,
} from '../../../core/models/outputs/document-output-dto';
import { testDocument } from '../../../testing/test-documents';

const suggestions = (changes: Partial<DocumentSuggestionsDto> = {}): DocumentSuggestionsDto => ({
  documentId: 'd1',
  ocrStatus: 'Done',
  merchant: 'Costco Wholesale',
  date: '2026-10-03',
  total: 33.05,
  kind: 'Receipt',
  warrantyMonths: 24,
  warrantyUntil: '2028-10-03',
  transactions: [
    {
      id: 't1',
      date: '2026-10-04',
      description: 'COSTCO WHOLESALE #1234',
      amount: 33.05,
      accountName: 'Visa',
      daysOff: 1,
      linked: false,
    },
  ],
  transactionsComplete: true,
  ...changes,
});

@Component({
  imports: [DocumentSuggestionsComponent],
  template: `<app-document-suggestions
    [document]="doc()"
    [canWrite]="canWrite()"
    (changed)="changes = changes + 1"
  />`,
})
class HostComponent {
  readonly doc = signal<DocumentDto>(
    testDocument({ id: 'd1', kind: 'Other', ocrStatus: 'Done', expiresOn: null, links: [] }),
  );
  readonly canWrite = signal(true);
  changes = 0;
}

describe('DocumentSuggestionsComponent', () => {
  let http: HttpTestingController;

  /** Lets the requests go out and the view update (not whenStable: it waits for the open requests). */
  async function tick(fixture: { detectChanges(): void }): Promise<void> {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  async function render(answer: DocumentSuggestionsDto | null = suggestions()) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await tick(fixture);
    if (answer) {
      http.expectOne('/api/documents/d1/suggestions').flush(answer);
    }
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    return fixture;
  }

  const byId = (fixture: { nativeElement: HTMLElement }, id: string) =>
    fixture.nativeElement.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const text = (el: Element | null) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim();

  afterEach(() => http.verify());

  it('says what it read, the matching transaction, and the one-tap actions', async () => {
    const fixture = await render();

    expect(text(byId(fixture, 'receipt-line'))).toBe('Costco Wholesale · Oct 3, 2026 · $33.05');
    expect(text(byId(fixture, 'matches'))).toContain(
      'COSTCO WHOLESALE #1234 Oct 4, 2026 · Visa · $33.05',
    );
    expect(byId(fixture, 'add-transaction')).not.toBeNull();
    expect(text(byId(fixture, 'set-kind'))).toBe('Mark as Receipt');
    expect(text(byId(fixture, 'set-expiry'))).toBe('Warranty until Oct 3, 2028: set as expiry');
    const inventory = byId(fixture, 'add-to-inventory')!.getAttribute('href')!;
    expect(decodeURIComponent(inventory)).toBe(
      '/home/items/new?name=Costco Wholesale&price=33.05&date=2026-10-03',
    );
  });

  it('links the matching transaction', async () => {
    const fixture = await render();

    byId(fixture, 'link-t1')!.click();
    const request = http.expectOne('/api/documents/d1/links');
    expect(request.request.body).toEqual({ kind: 'Money.Transaction', targetId: 't1' });
    request.flush({
      id: 'l1',
      kind: 'Money.Transaction',
      targetId: 't1',
      createdAt: '2026-10-16T00:00:00Z',
    });
    await tick(fixture);
    expect(fixture.componentInstance.changes).toBe(1);
  });

  it('opens the add form filled in, with the receipt to link', async () => {
    const fixture = await render();
    const adder = TestBed.inject(TransactionAddLauncher);

    byId(fixture, 'add-transaction')!.click();

    expect(adder.isOpen()).toBe(true);
    expect(adder.prefill()).toEqual({
      description: 'Costco Wholesale',
      amount: 33.05,
      date: '2026-10-03',
      documentId: 'd1',
    });
  });

  it('sets the kind and the expiry, and keeps the other details', async () => {
    const fixture = await render();

    byId(fixture, 'set-expiry')!.click();
    const request = http.expectOne((r) => r.method === 'PUT' && r.url === '/api/documents/d1');
    expect(request.request.body).toEqual(
      expect.objectContaining({ kind: 'Other', expiresOn: '2028-10-03' }),
    );
    request.flush(testDocument({ id: 'd1' }));
    await tick(fixture);
    expect(fixture.componentInstance.changes).toBe(1);
  });

  it('shows nothing before the OCR, or when the text says nothing', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.doc.set(testDocument({ id: 'd1', ocrStatus: 'Pending' }));
    fixture.detectChanges();
    await tick(fixture);
    expect(byId(fixture, 'suggestions')).toBeNull();

    expect(
      hasSuggestions(
        suggestions({ merchant: null, date: null, total: null, kind: null, warrantyUntil: null }),
      ),
    ).toBe(false);
  });

  it('offers no change to a read-only user', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.canWrite.set(false);
    fixture.detectChanges();
    await tick(fixture);
    http.expectOne('/api/documents/d1/suggestions').flush(suggestions());
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(byId(fixture, 'receipt-line')).not.toBeNull();
    expect(byId(fixture, 'link-t1')).toBeNull();
    expect(byId(fixture, 'add-transaction')).toBeNull();
  });
});
