import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { TransactionFilterInputDto } from '../models/inputs/transaction-filter-input-dto';
import { TransactionOutputDto } from '../models/outputs/transaction-output-dto';
import { PaginatedResult } from '../models/outputs/paginated-result-output-dto';
import { TransactionLinkingInputDto } from '../models/inputs/transaction-linking-input-dto';

@Injectable({
  providedIn: 'root',
})
export class TransactionRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl: string = `${API_BASE_URL}/Transaction`;
  linkTransaction(linkingTransactionInputDto: TransactionLinkingInputDto): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/LinkTransaction`, linkingTransactionInputDto);
  }

  unlinkTransaction(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/UnlinkTransaction/${id}`, null);
  }
  filter(filterDto: TransactionFilterInputDto): Observable<PaginatedResult<TransactionOutputDto>> {
    return this.http.post<PaginatedResult<TransactionOutputDto>>(
      `${this.baseUrl}/Filter`,
      filterDto,
    );
  }
}
