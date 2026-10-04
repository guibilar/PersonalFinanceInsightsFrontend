import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { TagInputDto } from '../models/inputs/tag-input-dto';
import { TagOutputDto } from '../models/outputs/tag-output-dto';

/** Free labels on transactions, across categories. Names are unique ignoring case (409 otherwise). */
@Injectable({
  providedIn: 'root',
})
export class TagRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl: string = `${API_BASE_URL}/Tags`;

  /** Every tag, by name, with how many transactions carry it. */
  getAll(): Observable<TagOutputDto[]> {
    return this.http.get<TagOutputDto[]>(this.baseUrl);
  }

  create(tag: TagInputDto): Observable<TagOutputDto> {
    return this.http.post<TagOutputDto>(this.baseUrl, tag);
  }

  rename(id: string, tag: TagInputDto): Observable<TagOutputDto> {
    return this.http.put<TagOutputDto>(`${this.baseUrl}/${id}`, tag);
  }

  /** Deletes it and takes it off every transaction. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
