import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { PaginatedResult } from '../models/outputs/paginated-result-output-dto';
import {
  JournalEntryDto,
  JournalEntrySummaryDto,
  JournalSummaryDto,
} from '../models/outputs/journal-output-dto';

/** The filters of the entry list. Days are `yyyy-MM-dd`. */
export interface JournalListQuery {
  q?: string | null;
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
}

/**
 * The Journal module of Hestia.Api (T21): one entry per day. A read-only user can call the GET endpoints only (403
 * otherwise).
 */
@Injectable({
  providedIn: 'root',
})
export class JournalRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/journal`;

  /** Today's entry, the streak, the week, and "On this day". */
  summary(): Observable<JournalSummaryDto> {
    return this.http.get<JournalSummaryDto>(`${this.baseUrl}/summary`);
  }

  /** A page of entries, newest first (with `q`: best match first). */
  list(query: JournalListQuery = {}): Observable<PaginatedResult<JournalEntrySummaryDto>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') params = params.set(key, value);
    }
    return this.http.get<PaginatedResult<JournalEntrySummaryDto>>(`${this.baseUrl}/entries`, {
      params,
    });
  }

  /** The entry of one day. The server answers 404 when the day has none. */
  get(day: string): Observable<JournalEntryDto> {
    return this.http.get<JournalEntryDto>(`${this.baseUrl}/entries/${day}`);
  }

  /** Writes the whole text of a day (a new entry, or a new text). */
  save(day: string, text: string): Observable<JournalEntryDto> {
    return this.http.put<JournalEntryDto>(`${this.baseUrl}/entries/${day}`, { text });
  }

  delete(day: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/entries/${day}`);
  }
}
