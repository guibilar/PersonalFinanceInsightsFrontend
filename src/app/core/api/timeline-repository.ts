import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { TimelineDto } from '../models/outputs/timeline-output-dto';

/** One page: it ends the day before `before` (none: today), with `days` days (1 to 31), of one `module` or all. */
export interface TimelineQuery {
  before?: string | null;
  days?: number;
  module?: string | null;
}

/** The Timeline module of Hestia.Api (T16): what happened in all modules, day by day. It only reads. */
@Injectable({
  providedIn: 'root',
})
export class TimelineRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/timeline`;

  page(query: TimelineQuery = {}): Observable<TimelineDto> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') params = params.set(key, value);
    }
    return this.http.get<TimelineDto>(this.baseUrl, { params });
  }
}
