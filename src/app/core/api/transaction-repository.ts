import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { TransactionFilterInputDto } from '../models/inputs/transaction-filter-input-dto';
import { TransactionOutputDto } from '../models/outputs/transaction-output-dto';
import { PaginatedResult } from '../models/outputs/paginated-result-output-dto';
import { TransactionLinkingInputDto } from '../models/inputs/transaction-linking-input-dto';
import { ImportResultOutputDto } from '../models/outputs/import-result-output-dto';
import { TransactionInputDto } from '../models/inputs/transaction-input-dto';
import { TransactionUpdateInputDto } from '../models/inputs/transaction-update-input-dto';
import { ApplyRulesResultOutputDto } from '../models/outputs/apply-rules-result-output-dto';

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
  /**
   * Uploads a bank statement CSV into an account; rows already imported are skipped by the API. When the file
   * doesn't look like it belongs to that account, the API answers 409 (code "account-mismatch") unless
   * `confirmed` is true.
   */
  importStatement(
    file: File,
    accountId: string,
    confirmed = false,
  ): Observable<ImportResultOutputDto> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('accountId', accountId);
    if (confirmed) form.append('confirmed', 'true');
    return this.http.post<ImportResultOutputDto>(`${this.baseUrl}/Import`, form);
  }

  /** Adds a transaction by hand. An identical one is a 409, unless `allowDuplicate` is set. */
  add(transaction: TransactionInputDto): Observable<TransactionOutputDto> {
    return this.http.post<TransactionOutputDto>(this.baseUrl, transaction);
  }

  /** Corrects description, category and flow; a changed category or flow is then kept when rules are re-applied. */
  update(id: string, update: TransactionUpdateInputDto): Observable<TransactionOutputDto> {
    return this.http.put<TransactionOutputDto>(`${this.baseUrl}/${id}`, update);
  }

  /**
   * Re-runs the current category and flow rules over the stored transactions. Categories and flows picked by
   * hand, and the categories of savings transactions, are left alone.
   */
  applyRules(): Observable<ApplyRulesResultOutputDto> {
    return this.http.post<ApplyRulesResultOutputDto>(`${this.baseUrl}/ApplyRules`, null);
  }

  /**
   * Deletes a transaction from lists, reports and budgets. The API keeps it hidden, so re-importing its
   * statement doesn't add it back, and {@link restore} undoes it.
   */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  restore(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/Restore`, null);
  }

  filter(filterDto: TransactionFilterInputDto): Observable<PaginatedResult<TransactionOutputDto>> {
    return this.http.post<PaginatedResult<TransactionOutputDto>>(
      `${this.baseUrl}/Filter`,
      filterDto,
    );
  }
}
