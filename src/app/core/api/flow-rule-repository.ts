import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { FlowRuleInputDto } from '../models/inputs/flow-rule-input-dto';
import { FlowRuleOutputDto } from '../models/outputs/flow-rule-output-dto';

/**
 * The rules that set a transaction's flow (income, refund, transfer, ignored): the longest keyword in the
 * description wins. Changes apply to later imports; TransactionRepository.applyRules applies them to stored
 * transactions.
 */
@Injectable({
  providedIn: 'root',
})
export class FlowRuleRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl: string = `${API_BASE_URL}/FlowRules`;

  /** All rules, by keyword. */
  getAll(): Observable<FlowRuleOutputDto[]> {
    return this.http.get<FlowRuleOutputDto[]>(this.baseUrl);
  }

  create(rule: FlowRuleInputDto): Observable<FlowRuleOutputDto> {
    return this.http.post<FlowRuleOutputDto>(this.baseUrl, rule);
  }

  update(id: string, rule: FlowRuleInputDto): Observable<FlowRuleOutputDto> {
    return this.http.put<FlowRuleOutputDto>(`${this.baseUrl}/${id}`, rule);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
