import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { PaginatedResult } from '../models/outputs/paginated-result-output-dto';
import {
  DocumentDto,
  DocumentLinkDto,
  DocumentSummaryDto,
  MONEY_TRANSACTION_LINK,
} from '../models/outputs/document-output-dto';
import { DocumentDetailsInputDto, DocumentListQuery } from '../models/inputs/document-input-dto';

/** The Documents module of Hestia.Api. A read-only user can call the GET endpoints only (403 otherwise). */
@Injectable({
  providedIn: 'root',
})
export class DocumentRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/documents`;

  /** A page of documents, newest first (best match first with `q`). */
  list(query: DocumentListQuery = {}): Observable<PaginatedResult<DocumentSummaryDto>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') params = params.set(key, value);
    }
    return this.http.get<PaginatedResult<DocumentSummaryDto>>(this.baseUrl, { params });
  }

  /** The documents linked to one finance transaction, newest first. */
  /**
   * How many documents link to each of some things (T72), by id in its stored form (lower case), 0 included. At most
   * 200 ids. A read-only query: the read-only user can call it.
   */
  countByLink(kind: string, targetIds: readonly string[]): Observable<Record<string, number>> {
    return this.http.post<Record<string, number>>(`${this.baseUrl}/by-link/counts`, {
      kind,
      targetIds,
    });
  }

  listByTransaction(transactionId: string): Observable<DocumentSummaryDto[]> {
    const params = new HttpParams().set('kind', MONEY_TRANSACTION_LINK).set('id', transactionId);
    return this.http.get<DocumentSummaryDto[]>(`${this.baseUrl}/by-link`, { params });
  }

  /** One document, with its OCR text. */
  get(id: string): Observable<DocumentDto> {
    return this.http.get<DocumentDto>(`${this.baseUrl}/${id}`);
  }

  /**
   * Uploads one document: its files and details. The events report the upload progress; the last one is the answer
   * (201, with `ocrStatus` `Pending`: the OCR runs in the background).
   */
  upload(
    files: readonly File[],
    details: DocumentDetailsInputDto,
  ): Observable<HttpEvent<DocumentDto>> {
    const form = new FormData();
    for (const file of files) form.append('files', file, file.name);
    form.append('title', details.title);
    form.append('kind', details.kind);
    for (const tag of details.tags) form.append('tags', tag);
    if (details.issuedOn) form.append('issuedOn', details.issuedOn);
    if (details.expiresOn) form.append('expiresOn', details.expiresOn);
    if (details.notes) form.append('notes', details.notes);
    return this.http.post<DocumentDto>(this.baseUrl, form, {
      observe: 'events',
      reportProgress: true,
    });
  }

  /** Replaces all details. The files stay. */
  update(id: string, details: DocumentDetailsInputDto): Observable<DocumentDto> {
    return this.http.put<DocumentDto>(`${this.baseUrl}/${id}`, details);
  }

  /** Deletes the document, its links and its files. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Runs the OCR again, in the background (the answer has `ocrStatus` `Pending`). */
  retryOcr(id: string): Observable<DocumentDto> {
    return this.http.post<DocumentDto>(`${this.baseUrl}/${id}/ocr`, null);
  }

  /** Links the document to a finance transaction. The host checks that the transaction exists. */
  linkTransaction(id: string, transactionId: string): Observable<DocumentLinkDto> {
    return this.http.post<DocumentLinkDto>(`${this.baseUrl}/${id}/links`, {
      kind: MONEY_TRANSACTION_LINK,
      targetId: transactionId,
    });
  }

  /** Links the document to something in another module, for example a Home item (`Home.Item`). */
  addLink(id: string, kind: string, targetId: string): Observable<DocumentLinkDto> {
    return this.http.post<DocumentLinkDto>(`${this.baseUrl}/${id}/links`, { kind, targetId });
  }

  unlink(id: string, linkId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/links/${linkId}`);
  }

  /** The address of a file: a download, or with `inline` a view in the browser (a PDF viewer, an image). */
  fileUrl(documentId: string, fileId: string, inline = false): string {
    const url = `${this.baseUrl}/${documentId}/files/${fileId}`;
    return inline ? `${url}?inline=true` : url;
  }
}
