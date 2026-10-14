import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { DocumentUploadComponent } from './document-upload.component';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import {
  DOC_ID,
  TX_ID,
  testDocument,
  testPage,
  testTransaction,
} from '../../../testing/test-documents';
import { signInAsReadOnly } from '../../../testing/test-auth';
import { ITEM_ID, testItem } from '../../../testing/test-home';

describe('DocumentUploadComponent', () => {
  let fixture: ComponentFixture<DocumentUploadComponent>;
  let component: DocumentUploadComponent;
  let http: HttpTestingController;
  let router: Router;

  const root = () => fixture.nativeElement as HTMLElement;
  const MB = 1024 * 1024;

  function file(name: string, type: string, size?: number): File {
    const file = new File(['%PDF-1.7 content'], name, { type });
    if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
    return file;
  }

  function list(...files: File[]): File[] {
    return files;
  }

  async function render(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    fixture.detectChanges();
  }

  function uploadButton(): HTMLButtonElement {
    return root().querySelector<HTMLButtonElement>('button[type="submit"]')!;
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DocumentUploadComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(DocumentUploadComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await render();
  });

  afterEach(() => http.verify());

  it('cannot upload before a file is chosen', () => {
    expect(uploadButton().disabled).toBe(true);
    component.submit();
    http.expectNone('/api/documents');
  });

  it('takes the title from the first file, and lists the chosen files', async () => {
    component.add(
      list(file('Kettle receipt.pdf', 'application/pdf'), file('back.jpg', 'image/jpeg')),
    );
    await render();

    expect(component.form.controls.title.value).toBe('Kettle receipt');
    const names = Array.from(root().querySelectorAll('[data-testid="chosen-files"] li')).map((li) =>
      li.querySelector('[title]')!.textContent!.trim(),
    );
    expect(names).toEqual(['Kettle receipt.pdf', 'back.jpg']);
    expect(uploadButton().disabled).toBe(false);

    root().querySelector<HTMLButtonElement>('button[aria-label="Remove back.jpg"]')!.click();
    await render();
    expect(root().querySelectorAll('[data-testid="chosen-files"] li').length).toBe(1);
  });

  it('checks the type and size in the browser, and sends nothing then', async () => {
    component.add(
      list(file('notes.txt', 'text/plain'), file('scan.pdf', 'application/pdf', 26 * MB)),
    );
    await render();

    expect(root().querySelector('[data-testid="file-problems"]')!.textContent).toContain(
      '“notes.txt” is not a PDF, JPEG, PNG, HEIC or WebP file.',
    );
    expect(root().querySelector('[data-testid="file-problems"]')!.textContent).toContain(
      '“scan.pdf” is larger than 25 MB.',
    );
    expect(uploadButton().disabled).toBe(true);
    component.submit();
    http.expectNone('/api/documents');
  });

  it('takes dropped files', async () => {
    const zone = root().querySelector<HTMLElement>('.drop-zone')!;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file('lease.pdf', 'application/pdf'));

    zone.dispatchEvent(new DragEvent('dragover', { dataTransfer, cancelable: true }));
    await render();
    expect(zone.classList).toContain('dragging');

    zone.dispatchEvent(new DragEvent('drop', { dataTransfer, cancelable: true }));
    await render();
    expect(zone.classList).not.toContain('dragging');
    expect(component.files().map((f) => f.name)).toEqual(['lease.pdf']);
    expect(component.form.controls.title.value).toBe('lease');
  });

  it('uploads the files and details, shows the progress, then opens the document', async () => {
    const changes = TestBed.inject(DataChangesService);
    const before = changes.version();
    component.add(list(file('warranty.pdf', 'application/pdf')));
    component.form.patchValue({
      title: ' Dishwasher warranty ',
      kind: 'Warranty',
      tags: 'Kitchen, appliances',
      expiresOn: '2026-11-09',
    });
    await render();

    uploadButton().click();
    const request = http.expectOne({ method: 'POST', url: '/api/documents' });
    const form = request.request.body as FormData;
    expect(form.get('title')).toBe('Dishwasher warranty');
    expect(form.get('kind')).toBe('Warranty');
    expect(form.getAll('tags')).toEqual(['kitchen', 'appliances']);
    expect(form.get('expiresOn')).toBe('2026-11-09');
    expect(form.has('issuedOn')).toBe(false);

    request.event({ type: HttpEventType.UploadProgress, loaded: 40, total: 100 });
    await render();
    expect(root().querySelector('.progress')!.getAttribute('aria-valuenow')).toBe('40');
    expect(uploadButton().disabled).toBe(true);

    request.flush(testDocument({ ocrStatus: 'Pending' }), { status: 201, statusText: 'Created' });
    await render();
    expect(router.navigate).toHaveBeenCalledWith(['/documents', DOC_ID]);
    expect(
      TestBed.inject(ToastService)
        .toasts()
        .map((t) => t.message),
    ).toEqual(['Added “Dishwasher warranty”']);
    expect(changes.version()).toBe(before + 1);
  });

  it('shows why the server refused the upload, and keeps the form', async () => {
    component.add(list(file('scan.pdf', 'application/pdf')));
    await render();

    uploadButton().click();
    http
      .expectOne('/api/documents')
      .flush(
        { errors: { files: ['“scan.pdf” is not a PDF, JPEG, PNG, HEIC, or WebP file.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await render();

    expect(root().querySelector('[data-testid="server-error"]')!.textContent).toContain(
      'is not a PDF, JPEG, PNG, HEIC, or WebP file.',
    );
    expect(component.files().length).toBe(1);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(uploadButton().disabled).toBe(false);
  });

  it('says so when the account can only read', async () => {
    component.add(list(file('scan.pdf', 'application/pdf')));
    await render();

    uploadButton().click();
    http.expectOne('/api/documents').flush(null, { status: 403, statusText: 'Forbidden' });
    await render();

    expect(root().querySelector('[data-testid="server-error"]')!.textContent).toContain(
      'This account can only read documents.',
    );
  });

  it('shows a read-only user why, in place of the form', async () => {
    expect(uploadButton()).not.toBeNull();

    await signInAsReadOnly(http);
    await render();

    expect(root().querySelector('form')).toBeNull();
    expect(root().querySelector('[data-testid="read-only"]')!.textContent).toContain(
      'This account can only read documents.',
    );
  });

  it('stops an upload that is running', async () => {
    component.add(list(file('scan.pdf', 'application/pdf')));
    await render();

    uploadButton().click();
    const request = http.expectOne('/api/documents');
    await render();
    Array.from(root().querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent!.trim() === 'Stop the upload')!
      .click();
    await render();

    expect(request.cancelled).toBe(true);
    expect(component.uploading()).toBe(false);
  });
});

describe('DocumentUploadComponent from a transaction', () => {
  let fixture: ComponentFixture<DocumentUploadComponent>;
  let component: DocumentUploadComponent;
  let http: HttpTestingController;
  let router: Router;

  const root = () => fixture.nativeElement as HTMLElement;
  const messages = () =>
    TestBed.inject(ToastService)
      .toasts()
      .map((t) => t.message);

  async function render(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    fixture.detectChanges();
  }

  function create(transactionId: string): void {
    TestBed.configureTestingModule({
      imports: [DocumentUploadComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ transactionId }) } },
        },
      ],
    });
    fixture = TestBed.createComponent(DocumentUploadComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  }

  async function opened(): Promise<void> {
    create(TX_ID);
    await render();
    const lookup = http.expectOne({ method: 'POST', url: '/api/Transaction/Filter' });
    expect(lookup.request.body).toEqual({ transactionId: TX_ID, page: 1, pageSize: 1 });
    lookup.flush(testPage([testTransaction()]));
    await render();
  }

  async function upload(): Promise<void> {
    component.add([new File(['%PDF-1.7'], 'receipt.pdf', { type: 'application/pdf' })]);
    await render();
    root().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    http
      .expectOne({ method: 'POST', url: '/api/documents' })
      .flush(testDocument({ title: 'receipt', kind: 'Receipt' }), {
        status: 201,
        statusText: 'Created',
      });
    await render();
  }

  afterEach(() => http.verify());

  it('names the transaction, starts as a receipt, and goes back to the transaction', async () => {
    await opened();

    expect(root().querySelector('[data-testid="link-target"]')!.textContent).toContain(
      'COSTCO WHOLESALE',
    );
    expect(component.form.controls.kind.value).toBe('Receipt');
    const back = root().querySelector<HTMLAnchorElement>('a.back-link')!;
    expect(back.textContent).toContain('Transaction');
    expect(back.getAttribute('href')).toBe(`/money/transactions?id=${TX_ID}`);
  });

  it('links the new document to the transaction, then opens the transaction', async () => {
    await opened();
    await upload();

    const link = http.expectOne({ method: 'POST', url: `/api/documents/${DOC_ID}/links` });
    expect(link.request.body).toEqual({ kind: 'Money.Transaction', targetId: TX_ID });
    expect(component.uploading()).toBe(true);
    link.flush({ id: 'l1', kind: 'Money.Transaction', targetId: TX_ID, createdAt: '' });
    await render();

    expect(router.navigate).toHaveBeenCalledWith(['/money/transactions'], {
      queryParams: { id: TX_ID },
    });
    expect(messages()).toEqual(['Added “receipt” to the transaction']);
    expect(component.uploading()).toBe(false);
  });

  it('opens the document when the link fails, and says so', async () => {
    await opened();
    await upload();

    http
      .expectOne({ method: 'POST', url: `/api/documents/${DOC_ID}/links` })
      .flush(null, { status: 502, statusText: 'Bad Gateway' });
    await render();

    expect(router.navigate).toHaveBeenCalledWith(['/documents', DOC_ID]);
    expect(messages()).toEqual([
      'Added “receipt”, but could not link it to the transaction. Link it from its page.',
    ]);
  });

  it('ignores a transaction id that is not a GUID', async () => {
    create('not-a-guid');
    await render();

    expect(component.transactionId).toBeNull();
    expect(root().querySelector('[data-testid="link-target"]')).toBeNull();
    expect(root().querySelector('a.back-link')!.getAttribute('href')).toBe('/documents');
  });
});

describe('DocumentUploadComponent from a Home item', () => {
  let fixture: ComponentFixture<DocumentUploadComponent>;
  let component: DocumentUploadComponent;
  let http: HttpTestingController;
  let router: Router;

  const root = () => fixture.nativeElement as HTMLElement;
  const messages = () =>
    TestBed.inject(ToastService)
      .toasts()
      .map((t) => t.message);

  async function render(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    fixture.detectChanges();
  }

  async function opened(): Promise<void> {
    TestBed.configureTestingModule({
      imports: [DocumentUploadComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ homeItemId: ITEM_ID }) } },
        },
      ],
    });
    fixture = TestBed.createComponent(DocumentUploadComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await render();
    http.expectOne(`/api/home/items/${ITEM_ID}`).flush(testItem());
    await render();
  }

  afterEach(() => http.verify());

  it('names the item, starts as a receipt, and goes back to the item', async () => {
    await opened();

    expect(root().querySelector('[data-testid="link-target"]')!.textContent).toContain(
      'Dishwasher',
    );
    expect(component.form.controls.kind.value).toBe('Receipt');
    const back = root().querySelector<HTMLAnchorElement>('a.back-link')!;
    expect(back.textContent).toContain('Item');
    expect(back.getAttribute('href')).toBe(`/home/items/${ITEM_ID}`);
  });

  it('links the new document to the item (Home.Item), then opens the item', async () => {
    await opened();
    component.add([new File(['%PDF-1.7'], 'receipt.pdf', { type: 'application/pdf' })]);
    await render();
    root().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    http
      .expectOne({ method: 'POST', url: '/api/documents' })
      .flush(testDocument({ title: 'receipt', kind: 'Receipt' }), {
        status: 201,
        statusText: 'Created',
      });
    await render();

    const link = http.expectOne({ method: 'POST', url: `/api/documents/${DOC_ID}/links` });
    expect(link.request.body).toEqual({ kind: 'Home.Item', targetId: ITEM_ID });
    link.flush({ id: 'l1', kind: 'Home.Item', targetId: ITEM_ID, createdAt: '' });
    await render();

    expect(router.navigate).toHaveBeenCalledWith(['/home/items', ITEM_ID]);
    expect(messages()).toEqual(['Added “receipt” to the item']);
  });
});
