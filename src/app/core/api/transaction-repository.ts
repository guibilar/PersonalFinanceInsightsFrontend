import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { TransactionFilterInputDto } from '../models/inputs/transaction-filter-input-dto';
import { TransactionOutputDto } from '../models/outputs/transaction-output-dto';
import { PaginatedResult } from '../models/outputs/paginated-result-output-dto';
import { TransactionLinkingInputDto } from '../models/inputs/transaction-linking-input-dto';
import { ImportResultOutputDto } from '../models/outputs/import-result-output-dto';
import { AccountType } from '../models/enums/account-type';
import { TransactionUpdateInputDto } from '../models/inputs/transaction-update-input-dto';
import { CategoryRulesResultOutputDto } from '../models/outputs/category-rules-result-output-dto';

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
  /** Uploads a bank statement CSV; rows already imported are skipped by the API. */
  importStatement(file: File, account: AccountType): Observable<ImportResultOutputDto> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('account', account);
    return this.http.post<ImportResultOutputDto>(`${this.baseUrl}/Import`, form);
  }

  /** Corrects description and category; the category is then kept when rules are re-applied. */
  update(id: string, update: TransactionUpdateInputDto): Observable<TransactionOutputDto> {
    return this.http.put<TransactionOutputDto>(`${this.baseUrl}/${id}`, update);
  }

  /** Re-runs the current category rules over every transaction whose category wasn't picked by hand. */
  applyCategoryRules(): Observable<CategoryRulesResultOutputDto> {
    return this.http.post<CategoryRulesResultOutputDto>(`${this.baseUrl}/ApplyCategoryRules`, null);
  }

  filter(filterDto: TransactionFilterInputDto): Observable<PaginatedResult<TransactionOutputDto>> {
    return this.http.post<PaginatedResult<TransactionOutputDto>>(
      `${this.baseUrl}/Filter`,
      filterDto,
    );
  }
}
