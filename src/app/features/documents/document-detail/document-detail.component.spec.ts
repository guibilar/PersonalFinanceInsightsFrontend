import { Component, input, output, provideZonelessChangeDetection } from '@angular/core';
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
import { DocumentDetailComponent } from './document-detail.component';
import { DocumentDto, DocumentSummaryDto } from '../../../core/models/outputs/document-output-dto';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { DOCUMENT_POLLING } from '../documents';
import {
  DOC_ID,
  PDF_ID,
  PHOTO_ID,
  TX_ID,
  testDocument,
  testPage,
  testTransaction,
} from '../../../testing/test-documents';
import { signInAsReadOnly } from '../../../testing/test-auth';
import { DocumentSuggestionsComponent } from '../document-suggestions/document-suggestions.component';
import { DocumentTasksComponent } from '../../tasks/document-tasks/document-tasks.component';
import { LinkedItemsComponent } from '../../home/linked-items/linked-items.component';
import { LinkedPeopleComponent } from '../../people/linked-people/linked-people.component';

/** The Tasks section has its own tests (DocumentTasksComponent); here it only shows which document it got. */
@Component({ selector: 'app-document-suggestions', template: '' })
class DocumentSuggestionsStub {
  readonly document = input.required<DocumentDto>();
  readonly canWrite = input(false);
  readonly changed = output<void>();
}

@Component({ selector: 'app-document-tasks', template: '{{ document().id }}' })
class DocumentTasksStub {
  readonly document = input.required<DocumentSummaryDto>();
}

/** The Home items section has its own tests (LinkedItemsComponent); here it only shows what it got. */
@Component({
  selector: 'app-linked-items',
  template: '<span data-testid="linked-items-stub">{{ kind() }} {{ ownerId() }}</span>',
})
class LinkedItemsStub {
  readonly kind = input.required<string>();
  readonly ownerId = input.required<string>();
  readonly ownerLinks = input<unknown[]>([]);
  readonly changed = output<void>();
}

/** The People section has its own tests (LinkedPeopleComponent); here it only shows what it got. */
@Component({
  selector: 'app-linked-people',
  template: '<span data-testid="linked-people-stub">{{ kind() }} {{ ownerId() }}</span>',
})
class LinkedPeopleStub {
  readonly kind = input.required<string>();
  readonly ownerId = input.required<string>();
  readonly ownerLinks = input<unknown[]>([]);
  readonly changed = output<void>();
}

const LINK = { id: 'link-1', kind: 'Money.Transaction', targetId: TX_ID, createdAt: '' };
const POLL_MS = 20;
/** The time limit of the one test of it. The others never reach theirs, however long a busy machine takes. */
const MAX_MS = 150;

describe('DocumentDetailComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let router: Router;
  let page: DocumentDetailComponent;
  let polling: { intervalMs: number; maxMs: number };

  const root = () => harness.routeNativeElement as HTMLElement;
  const docUrl = `/api/documents/${DOC_ID}`;
  const messages = () =>
    TestBed.inject(ToastService)
      .toasts()
      .map((t) => t.message);
  const button = (label: string) =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent!.trim() === label,
    );
  /** The buttons of the confirmation dialog, which shows in the top layer. */
  const confirmButton = (label: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find(
      (b) => b.textContent!.trim() === label,
    )!;

  async function render(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  async function wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
    TestBed.tick();
  }

  async function answer(document: DocumentDto = testDocument()): Promise<void> {
    TestBed.tick();
    http.expectOne({ method: 'GET', url: docUrl }).flush(document);
    await render();
  }

  /** The finance lookups of the linked transactions (POST /api/Transaction/Filter with an id). */
  function lookups(): TestRequest[] {
    TestBed.tick();
    return http.match((r) => r.url === '/api/Transaction/Filter' && !!r.body?.transactionId);
  }

  async function open(document: DocumentDto = testDocument()): Promise<void> {
    page = await harness.navigateByUrl(`/documents/${DOC_ID}`, DocumentDetailComponent);
    await answer(document);
  }

  beforeEach(async () => {
    polling = { intervalMs: POLL_MS, maxMs: 60_000 };
    TestBed.overrideComponent(DocumentDetailComponent, {
      remove: {
        imports: [
          DocumentTasksComponent,
          LinkedItemsComponent,
          LinkedPeopleComponent,
          DocumentSuggestionsComponent,
        ],
      },
      add: {
        imports: [DocumentTasksStub, LinkedItemsStub, LinkedPeopleStub, DocumentSuggestionsStub],
      },
    });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'documents/:id', component: DocumentDetailComponent },
          { path: 'documents', children: [] },
          { path: 'money/transactions', children: [] },
        ]),
        provideLocationMocks(),
        { provide: DOCUMENT_POLLING, useValue: polling },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  it('shows the details, the files to view and download, and the text, collapsed', async () => {
    await open();

    expect(root().querySelector('h1')!.textContent).toContain('Dishwasher warranty');
    const details = (root().querySelector('[data-testid="details"]') as HTMLElement).innerText;
    expect(details).toContain('Nov 9, 2024');
    expect(details).toContain('#kitchen');
    expect(details).toContain('Bought at Costco');

    const image = root().querySelector<HTMLImageElement>('img.file-preview')!;
    expect(image.getAttribute('src')).toBe(
      `/api/documents/${DOC_ID}/files/${PHOTO_ID}?inline=true`,
    );
    const view = root().querySelector('a[aria-label="Open warranty.pdf"]')!;
    expect(view.getAttribute('href')).toBe(`/api/documents/${DOC_ID}/files/${PDF_ID}?inline=true`);
    expect(view.getAttribute('target')).toBe('_blank');
    const download = root().querySelector('a[aria-label="Download warranty.pdf"]')!;
    expect(download.getAttribute('href')).toBe(`/api/documents/${DOC_ID}/files/${PDF_ID}`);
    expect(download.getAttribute('download')).toBe('warranty.pdf');
    // T62: the PDF also shows in a frame, from its own address; the photo does not.
    const frames = Array.from(
      root().querySelectorAll<HTMLIFrameElement>('[data-testid="pdf-preview"]'),
    );
    expect(frames.map((f) => f.getAttribute('src'))).toEqual([
      `/api/documents/${DOC_ID}/files/${PDF_ID}?inline=true`,
    ]);
    expect(frames[0].getAttribute('title')).toBe('Preview of warranty.pdf');

    const text = root().querySelector<HTMLDetailsElement>('[data-testid="ocr"] details')!;
    expect(text.open).toBe(false);
    expect(text.textContent).toContain('LIMITED WARRANTY two years');
  });

  it('shows the thumbnail of a HEIC photo, which browsers do not show (T61)', async () => {
    const heic = {
      ...testDocument().files[1],
      fileName: 'IMG_2031.HEIC',
      contentType: 'image/heic',
    };
    await open(testDocument({ files: [heic] }));

    const image = root().querySelector<HTMLImageElement>('[data-testid="heic-preview"]')!;
    expect(image.getAttribute('src')).toBe(`/api/documents/${DOC_ID}/files/${PHOTO_ID}/thumbnail`);
    expect(image.getAttribute('alt')).toBe('Preview of IMG_2031.HEIC');
    expect(image.closest('a')!.getAttribute('download')).toBe('IMG_2031.HEIC');
  });

  it('edits the details and saves them all', async () => {
    const changes = TestBed.inject(DataChangesService);
    const before = changes.version();
    await open();

    button('Edit')!.click();
    await render();
    const form = page.form()!;
    expect(form.controls.tags.value).toBe('kitchen, appliances');
    form.patchValue({ title: 'Dishwasher warranty (Bosch)', notes: '', expiresOn: '2027-11-09' });
    button('Save')!.click();

    const put = http.expectOne({ method: 'PUT', url: docUrl });
    expect(put.request.body).toEqual({
      title: 'Dishwasher warranty (Bosch)',
      kind: 'Warranty',
      tags: ['kitchen', 'appliances'],
      issuedOn: '2024-11-09',
      expiresOn: '2027-11-09',
      notes: null,
    });
    put.flush(testDocument({ title: 'Dishwasher warranty (Bosch)' }));
    await answer(testDocument({ title: 'Dishwasher warranty (Bosch)' }));

    expect(page.editing()).toBe(false);
    expect(messages()).toEqual(['Saved “Dishwasher warranty (Bosch)”']);
    expect(changes.version()).toBe(before + 1);
  });

  it('does not save an expiry before the issue day', async () => {
    await open();
    button('Edit')!.click();
    await render();

    page.form()!.patchValue({ expiresOn: '2020-01-01' });
    button('Save')!.click();
    await render();

    http.expectNone({ method: 'PUT', url: docUrl });
    expect(root().textContent).toContain('It cannot expire before it was issued.');
  });

  it('loads the document again while its text is read, until it is done', async () => {
    await open(testDocument({ ocrStatus: 'Pending', ocrText: null }));
    expect(root().querySelector('[data-testid="ocr"]')!.textContent).toContain(
      'Reading the text of the files…',
    );

    await wait(POLL_MS * 2);
    await answer(testDocument({ ocrStatus: 'Pending', ocrText: null }));
    await wait(POLL_MS * 2);
    await answer(testDocument({ ocrStatus: 'Done', ocrText: 'Found it' }));

    expect(root().querySelector('[data-testid="ocr"]')!.textContent).toContain('Found it');
    await wait(POLL_MS * 3);
    http.expectNone(docUrl);
  });

  it('stops asking after the time limit, and asks again on "Check again"', async () => {
    polling.maxMs = MAX_MS;
    const pending = testDocument({ ocrStatus: 'Pending', ocrText: null });
    await open(pending);

    // Answer every poll with Pending until the page stops.
    for (let i = 0; i < 20 && !page.stoppedPolling(); i++) {
      await wait(POLL_MS * 2);
      const requests = http.match(docUrl);
      requests.forEach((r) => r.flush(pending));
      await render();
    }
    expect(page.stoppedPolling()).toBe(true);
    expect(root().textContent).toContain('The text is still being read.');
    await wait(POLL_MS * 3);
    http.expectNone(docUrl);

    button('Check again')!.click();
    await answer(testDocument());
    expect(page.stoppedPolling()).toBe(false);
  });

  it('shows why the OCR failed, and runs it again', async () => {
    await open(
      testDocument({ ocrStatus: 'Failed', ocrError: 'scan.pdf: encrypted', ocrText: null }),
    );
    expect(root().textContent).toContain('The text could not be read.');
    expect(root().textContent).toContain('scan.pdf: encrypted');

    button('Run OCR again')!.click();
    http
      .expectOne({ method: 'POST', url: `${docUrl}/ocr` })
      .flush(testDocument({ ocrStatus: 'Pending', ocrText: null }), {
        status: 202,
        statusText: 'Accepted',
      });
    await answer(testDocument({ ocrStatus: 'Pending', ocrText: null }));
    expect(root().textContent).toContain('Reading the text of the files…');

    await wait(POLL_MS * 2);
    await answer(testDocument());
  });

  it('shows each linked transaction, which opens it in Money', async () => {
    await open(testDocument({ links: [LINK] }));
    const [lookup] = lookups();
    expect(lookup.request.body).toEqual({ transactionId: TX_ID, page: 1, pageSize: 1 });
    lookup.flush(testPage([testTransaction()]));
    await render();

    const link = root().querySelector<HTMLAnchorElement>('[data-testid="links"] a')!;
    expect(link.getAttribute('href')).toBe(`/money/transactions?id=${TX_ID}`);
    const row = (root().querySelector('[data-testid="links"] li') as HTMLElement).innerText;
    expect(row).toContain('COSTCO WHOLESALE');
    expect(row).toContain('Oct 3, 2026');
    expect(row).toContain('-$142.18');

    link.click();
    await render();
    expect(router.url).toBe(`/money/transactions?id=${TX_ID}`);
  });

  it('shows a Home item link in the Home items section, not with the transactions', async () => {
    await open(
      testDocument({
        links: [{ id: 'l-home', kind: 'Home.Item', targetId: 'item-1', createdAt: '' }],
      }),
    );

    expect(lookups()).toEqual([]);
    expect(root().querySelector('[data-testid="links"]')).toBeNull();
    expect(root().textContent).toContain('Link a receipt to its purchase');
    expect(root().querySelector('[data-testid="linked-items-stub"]')!.textContent).toBe(
      `Documents.Document ${DOC_ID}`,
    );
  });

  it('finds a deleted transaction among the deleted ones', async () => {
    await open(testDocument({ links: [LINK] }));
    lookups()[0].flush(testPage([]));
    const [hidden] = lookups();
    expect(hidden.request.body).toEqual({
      transactionId: TX_ID,
      hidden: true,
      page: 1,
      pageSize: 1,
    });
    hidden.flush(testPage([testTransaction({ hidden: true })]));
    await render();

    expect((root().querySelector('[data-testid="links"] li') as HTMLElement).innerText).toContain(
      'Deleted',
    );
  });

  it('links to a transaction picked from the recent ones', async () => {
    await open();
    button('Link to a transaction')!.click();
    await render();

    TestBed.tick();
    const recent = http.expectOne(
      (r) => r.url === '/api/Transaction/Filter' && !r.body?.transactionId,
    );
    expect(recent.request.body).toEqual({
      sortBy: 'Date',
      sortDirection: 'Descending',
      page: 1,
      pageSize: 10,
    });
    recent.flush(testPage([testTransaction()]));
    await render();

    document
      .querySelector<HTMLButtonElement>(
        '[data-testid="picker-transactions"] button[aria-label^="Link COSTCO WHOLESALE"]',
      )!
      .click();
    const post = http.expectOne({ method: 'POST', url: `${docUrl}/links` });
    expect(post.request.body).toEqual({ kind: 'Money.Transaction', targetId: TX_ID });
    post.flush(LINK, { status: 201, statusText: 'Created' });
    await answer(testDocument({ links: [LINK] }));
    lookups()[0].flush(testPage([testTransaction()]));
    await render();

    expect(page.picking()).toBe(false);
    expect(messages()).toEqual(['Linked to “COSTCO WHOLESALE”']);
    expect(root().querySelector('[data-testid="links"]')!.textContent).toContain(
      'COSTCO WHOLESALE',
    );
  });

  it('searches the transactions to link by description', async () => {
    await open();
    button('Link to a transaction')!.click();
    await render();
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/Transaction/Filter').flush(testPage([]));
    await render();

    const input = document.querySelector<HTMLInputElement>('#transaction-picker-search')!;
    input.value = 'costco';
    input.dispatchEvent(new Event('input'));
    await wait(400);

    const search = http.expectOne((r) => r.url === '/api/Transaction/Filter');
    expect(search.request.body).toEqual(expect.objectContaining({ description: 'costco' }));
    search.flush(testPage([]));
    await render();
    expect(document.querySelector('app-transaction-picker')!.textContent).toContain(
      'No transaction matches “costco”.',
    );
  });

  it('unlinks after a confirmation', async () => {
    await open(testDocument({ links: [LINK] }));
    lookups()[0].flush(testPage([testTransaction()]));
    await render();

    root()
      .querySelector<HTMLButtonElement>('button[aria-label^="Unlink “COSTCO WHOLESALE”"]')!
      .click();
    await render();
    confirmButton('Unlink').click();

    http.expectOne({ method: 'DELETE', url: `${docUrl}/links/link-1` }).flush(null);
    await answer(testDocument());
    expect(messages()).toEqual(['Unlinked']);
    expect(root().textContent).toContain('Link a receipt to its purchase');
  });

  it('deletes after a confirmation, then goes back to the list', async () => {
    await open();

    button('Delete')!.click();
    await render();
    confirmButton('Delete').click();

    http.expectOne({ method: 'DELETE', url: docUrl }).flush(null);
    await render();
    expect(router.url).toBe('/documents');
    expect(messages()).toEqual(['Deleted “Dishwasher warranty”']);
  });

  it('keeps the document when the delete is cancelled', async () => {
    await open();

    button('Delete')!.click();
    await render();
    confirmButton('Cancel').click();
    await render();

    http.expectNone({ method: 'DELETE', url: docUrl });
    expect(document.querySelector('app-confirm-dialog')).toBeNull();
  });

  it('says so when the document does not exist', async () => {
    page = await harness.navigateByUrl(`/documents/${DOC_ID}`, DocumentDetailComponent);
    TestBed.tick();
    http.expectOne(docUrl).flush(null, { status: 404, statusText: 'Not Found' });
    await render();

    expect(root().textContent).toContain('This document does not exist any more.');
  });

  it('says so when the account can only read', async () => {
    await open();

    button('Delete')!.click();
    await render();
    confirmButton('Delete').click();
    http.expectOne({ method: 'DELETE', url: docUrl }).flush(null, {
      status: 403,
      statusText: 'Forbidden',
    });
    await render();

    expect(messages()).toEqual(['This account can only read documents.']);
    expect(router.url).toBe(`/documents/${DOC_ID}`);
  });

  it('shows no change actions to a read-only user', async () => {
    await signInAsReadOnly(http);
    await open(
      testDocument({
        ocrStatus: 'Failed',
        ocrError: 'scan.pdf: encrypted',
        ocrText: null,
        links: [LINK],
      }),
    );
    lookups()[0].flush(testPage([testTransaction()]));
    await render();

    expect(root().querySelector('h1')!.textContent).toContain('Dishwasher warranty');
    expect(root().querySelector('[data-testid="links"] a')).not.toBeNull();
    for (const label of ['Delete', 'Edit', 'Run OCR again', 'Link to a transaction']) {
      expect(button(label)).toBeUndefined();
    }
    expect(root().querySelector('button[title="Unlink"]')).toBeNull();
  });
});
