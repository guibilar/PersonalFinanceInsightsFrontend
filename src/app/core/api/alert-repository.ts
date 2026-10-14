import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { AlertListDto } from '../models/outputs/alert-output-dto';

/** The Alerts API of Hestia.Api: the open "Needs attention" items of all modules. */
@Injectable({
  providedIn: 'root',
})
export class AlertRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/alerts`;

  /**
   * The open alerts. With `refresh`, the server checks its rules first (it waits at most 10 seconds), for example
   * after a data change from this app.
   */
  get(refresh = false): Observable<AlertListDto> {
    const params = refresh ? new HttpParams().set('refresh', 'true') : undefined;
    return this.http.get<AlertListDto>(this.url, { params });
  }
}
