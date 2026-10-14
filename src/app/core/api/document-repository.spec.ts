import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DocumentRepository } from './document-repository';
import { DOC_ID, PDF_ID, TX_ID, testDocument, testPage } from '../../testing/test-documents';

describe('DocumentRepository', () => {
  let repository: DocumentRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    repository = TestBed.inject(DocumentRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists with only the filters that have a value', () => {
    repository
      .list({
        kind: 'Warranty',
        q: '',
        tag: null,
        expiresFrom: '2026-10-13',
        page: 2,
        pageSize: 20,
      })
      .subscribe();

    const request = http.expectOne((r) => r.url === '/api/documents');
    expect(request.request.params.keys()).toEqual(['kind', 'expiresFrom', 'page', 'pageSize']);
    expect(request.request.params.get('kind')).toBe('Warranty');
    expect(request.request.params.get('page')).toBe('2');
    request.flush(testPage([]));
  });

  it('uploads the files and details as a form, with the progress', () => {
    const pdf = new File(['%PDF-1.7'], 'warranty.pdf', { type: 'application/pdf' });
    const photo = new File(['jpeg'], 'label.jpg', { type: 'image/jpeg' });
    const types: HttpEventType[] = [];

    repository
      .upload([pdf, photo], {
        title: 'Dishwasher warranty',
        kind: 'Warranty',
        tags: ['kitchen', 'appliances'],
        issuedOn: '2024-11-09',
        expiresOn: null,
        notes: null,
      })
      .subscribe((event) => types.push(event.type));

    const request = http.expectOne({ method: 'POST', url: '/api/documents' });
    expect(request.request.reportProgress).toBe(true);
    const form = request.request.body as FormData;
    expect((form.getAll('files') as File[]).map((f) => f.name)).toEqual([
      'warranty.pdf',
      'label.jpg',
    ]);
    expect(form.get('title')).toBe('Dishwasher warranty');
    expect(form.get('kind')).toBe('Warranty');
    expect(form.getAll('tags')).toEqual(['kitchen', 'appliances']);
    expect(form.get('issuedOn')).toBe('2024-11-09');
    expect(form.has('expiresOn')).toBe(false);
    expect(form.has('notes')).toBe(false);

    request.event({ type: HttpEventType.UploadProgress, loaded: 5, total: 10 });
    request.flush(testDocument({ ocrStatus: 'Pending' }), { status: 201, statusText: 'Created' });
    expect(types).toContain(HttpEventType.UploadProgress);
    expect(types.at(-1)).toBe(HttpEventType.Response);
  });

  it('lists the documents of one transaction', () => {
    let documents: unknown;
    repository.listByTransaction(TX_ID).subscribe((d) => (documents = d));
    const request = http.expectOne((r) => r.method === 'GET' && r.url === '/api/documents/by-link');
    expect(request.request.params.get('kind')).toBe('Money.Transaction');
    expect(request.request.params.get('id')).toBe(TX_ID);
    request.flush([]);
    expect(documents).toEqual([]);
  });

  it('links to a transaction, and unlinks', () => {
    repository.linkTransaction(DOC_ID, TX_ID).subscribe();
    const link = http.expectOne({ method: 'POST', url: `/api/documents/${DOC_ID}/links` });
    expect(link.request.body).toEqual({ kind: 'Money.Transaction', targetId: TX_ID });
    link.flush({ id: 'l1', kind: 'Money.Transaction', targetId: TX_ID, createdAt: '' });

    repository.unlink(DOC_ID, 'l1').subscribe();
    http.expectOne({ method: 'DELETE', url: `/api/documents/${DOC_ID}/links/l1` }).flush(null);
  });

  it('changes, retries the OCR, and deletes', () => {
    repository
      .update(DOC_ID, {
        title: 'T',
        kind: 'Other',
        tags: [],
        issuedOn: null,
        expiresOn: null,
        notes: null,
      })
      .subscribe();
    const put = http.expectOne({ method: 'PUT', url: `/api/documents/${DOC_ID}` });
    expect(put.request.body).toEqual(expect.objectContaining({ title: 'T', notes: null }));
    put.flush(testDocument());

    repository.retryOcr(DOC_ID).subscribe();
    http.expectOne({ method: 'POST', url: `/api/documents/${DOC_ID}/ocr` }).flush(testDocument());

    repository.delete(DOC_ID).subscribe();
    http.expectOne({ method: 'DELETE', url: `/api/documents/${DOC_ID}` }).flush(null);
  });

  it('gives the address of a file, to download or to view', () => {
    expect(repository.fileUrl(DOC_ID, PDF_ID)).toBe(`/api/documents/${DOC_ID}/files/${PDF_ID}`);
    expect(repository.fileUrl(DOC_ID, PDF_ID, true)).toBe(
      `/api/documents/${DOC_ID}/files/${PDF_ID}?inline=true`,
    );
  });
});
