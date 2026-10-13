import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { TodayDto } from '../models/outputs/today-output-dto';

/** The Today API of Hestia.Api: the cards of all modules in one answer. */
@Injectable({
  providedIn: 'root',
})
export class TodayRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/today`;

  /** The cards for today. With `refresh`, the server makes a new answer and does not use its short cache. */
  get(refresh = false): Observable<TodayDto> {
    const params = refresh ? new HttpParams().set('refresh', 'true') : undefined;
    return this.http.get<TodayDto>(this.url, { params });
  }
}
