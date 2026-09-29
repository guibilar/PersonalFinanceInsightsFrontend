import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { CategoryInputDto } from '../models/inputs/category-input-dto';
import { CategoryOutputDto } from '../models/outputs/category-output-dto';

/** The categories transactions, rules and budgets use. Names are unique (409 otherwise). */
@Injectable({
  providedIn: 'root',
})
export class CategoryRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl: string = `${API_BASE_URL}/Categories`;

  /** Every category, by name. */
  getAll(): Observable<CategoryOutputDto[]> {
    return this.http.get<CategoryOutputDto[]>(this.baseUrl);
  }

  create(category: CategoryInputDto): Observable<CategoryOutputDto> {
    return this.http.post<CategoryOutputDto>(this.baseUrl, category);
  }

  /** Renames and/or recolours it; everything using it follows. */
  update(id: string, category: CategoryInputDto): Observable<CategoryOutputDto> {
    return this.http.put<CategoryOutputDto>(`${this.baseUrl}/${id}`, category);
  }

  /**
   * Deletes it after moving its transactions and rules to `moveTo` (Other when omitted). The built-in ones give 409.
   */
  delete(id: string, moveTo?: string): Observable<void> {
    const params = moveTo ? new HttpParams().set('moveTo', moveTo) : undefined;
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { params });
  }
}
