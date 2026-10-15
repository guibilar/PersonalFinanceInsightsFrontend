import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { SearchDto } from '../models/outputs/search-output-dto';

/** The Search module of Hestia.Api (T17): one search across all modules. It only reads. */
@Injectable({
  providedIn: 'root',
})
export class SearchRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/search`;

  /** `q`: 2 to 200 characters. `module`: only that module, with more hits. */
  search(q: string, module: string | null = null): Observable<SearchDto> {
    let params = new HttpParams().set('q', q);
    if (module) params = params.set('module', module);
    return this.http.get<SearchDto>(this.baseUrl, { params });
  }
}
