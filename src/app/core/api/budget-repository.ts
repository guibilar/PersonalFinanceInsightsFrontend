import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BudgetInputDto } from '../models/inputs/budget-input-dto';
import { BudgetFilterInputDto } from '../models/inputs/budget-filter-input-dto';
import { BudgetOutputDto } from '../models/outputs/budget-output-dto';
import { PaginatedResult } from '../models/outputs/paginated-result-output-dto';

@Injectable({
  providedIn: 'root'
})
export class BudgetRepository {
  private readonly baseUrl: string = `${environment.apiUrl}/Budget`;

  constructor(private http: HttpClient) {}

  create(budgetDto: BudgetInputDto): Observable<void> {
    return this.http.post<void>(this.baseUrl, budgetDto);
  }

  update(id: string, budgetDto: BudgetInputDto): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, budgetDto);
  }

  getById(id: string): Observable<BudgetOutputDto> {
    return this.http.get<BudgetOutputDto>(`${this.baseUrl}/${id}`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  filter(filterDto: BudgetFilterInputDto): Observable<PaginatedResult<BudgetOutputDto>> {
    return this.http.post<PaginatedResult<BudgetOutputDto>>(`${this.baseUrl}/Filter`, filterDto);
  }
}
