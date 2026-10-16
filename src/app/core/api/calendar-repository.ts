import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { CalendarEventRequest } from '../models/inputs/calendar-input-dto';
import {
  CalendarDto,
  CalendarEventDto,
  CalendarImportResultDto,
} from '../models/outputs/calendar-output-dto';

/**
 * The Calendar module of Hestia.Api (T103): events, `.ics` import, and the dated things of all modules. A read-only user
 * can call the GET endpoints only (403 otherwise).
 */
@Injectable({
  providedIn: 'root',
})
export class CalendarRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/calendar`;

  /** The items from one day to another (both included, `yyyy-MM-dd`; at most 400 days). */
  range(from: string, to: string): Observable<CalendarDto> {
    return this.http.get<CalendarDto>(this.baseUrl, {
      params: new HttpParams().set('from', from).set('to', to),
    });
  }

  getEvent(id: string): Observable<CalendarEventDto> {
    return this.http.get<CalendarEventDto>(`${this.baseUrl}/events/${id}`);
  }

  createEvent(request: CalendarEventRequest): Observable<CalendarEventDto> {
    return this.http.post<CalendarEventDto>(`${this.baseUrl}/events`, request);
  }

  updateEvent(id: string, request: CalendarEventRequest): Observable<CalendarEventDto> {
    return this.http.put<CalendarEventDto>(`${this.baseUrl}/events/${id}`, request);
  }

  /** One occurrence of a repeated event does not happen. */
  skip(id: string, date: string): Observable<CalendarEventDto> {
    return this.http.post<CalendarEventDto>(`${this.baseUrl}/events/${id}/skip`, { date });
  }

  deleteEvent(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/events/${id}`);
  }

  /** Imports the text of an `.ics` file; `dryRun` only says what would change. */
  import(ics: string, dryRun: boolean): Observable<CalendarImportResultDto> {
    return this.http.post<CalendarImportResultDto>(`${this.baseUrl}/import`, { ics, dryRun });
  }
}
