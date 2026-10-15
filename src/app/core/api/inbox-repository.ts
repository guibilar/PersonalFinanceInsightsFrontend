import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { InboxItemDto } from '../models/outputs/inbox-output-dto';
import { PaginatedResult } from '../models/outputs/paginated-result-output-dto';

/**
 * The Inbox module of Hestia.Api (T18): quick notes kept to sort later. A read-only user can call the GET endpoints only.
 */
@Injectable({
  providedIn: 'root',
})
export class InboxRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/inbox`;

  /** The open notes, newest first; with `done`, the sorted ones, last sorted first. */
  list(done = false, pageSize = 50): Observable<PaginatedResult<InboxItemDto>> {
    const params = new HttpParams().set('done', done).set('pageSize', pageSize);
    return this.http.get<PaginatedResult<InboxItemDto>>(this.baseUrl, { params });
  }

  add(text: string): Observable<InboxItemDto> {
    return this.http.post<InboxItemDto>(this.baseUrl, { text });
  }

  update(id: string, text: string): Observable<InboxItemDto> {
    return this.http.put<InboxItemDto>(`${this.baseUrl}/${id}`, { text });
  }

  /** Marks a note sorted, with where it went (for example `Task`). */
  done(id: string, sortedTo: string | null = null): Observable<InboxItemDto> {
    return this.http.post<InboxItemDto>(`${this.baseUrl}/${id}/done`, { sortedTo });
  }

  reopen(id: string): Observable<InboxItemDto> {
    return this.http.post<InboxItemDto>(`${this.baseUrl}/${id}/reopen`, null);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
