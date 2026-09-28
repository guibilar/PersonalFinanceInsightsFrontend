import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { CategoryRuleInputDto } from '../models/inputs/category-rule-input-dto';
import { CategoryRulePreviewInputDto } from '../models/inputs/category-rule-preview-input-dto';
import { CategoryRuleOutputDto } from '../models/outputs/category-rule-output-dto';
import { CategoryRulePreviewOutputDto } from '../models/outputs/category-rule-preview-output-dto';

/**
 * The rules that categorise transactions: the first rule (by position) whose keyword is in the
 * description decides. Changes apply to later imports; TransactionRepository.applyRules
 * applies them to stored transactions.
 */
@Injectable({
  providedIn: 'root',
})
export class CategoryRuleRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl: string = `${API_BASE_URL}/CategoryRules`;

  /** All rules, in the order they are checked. */
  getAll(): Observable<CategoryRuleOutputDto[]> {
    return this.http.get<CategoryRuleOutputDto[]>(this.baseUrl);
  }

  create(rule: CategoryRuleInputDto): Observable<CategoryRuleOutputDto> {
    return this.http.post<CategoryRuleOutputDto>(this.baseUrl, rule);
  }

  update(id: string, rule: CategoryRuleInputDto): Observable<CategoryRuleOutputDto> {
    const { keyword, category } = rule;
    return this.http.put<CategoryRuleOutputDto>(`${this.baseUrl}/${id}`, { keyword, category });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Moves a rule to another position; answers with every rule in the new order. */
  move(id: string, position: number): Observable<CategoryRuleOutputDto[]> {
    return this.http.post<CategoryRuleOutputDto[]>(`${this.baseUrl}/${id}/Move`, { position });
  }

  /** What adding this rule first and re-applying the rules would change. */
  preview(rule: CategoryRulePreviewInputDto): Observable<CategoryRulePreviewOutputDto> {
    return this.http.post<CategoryRulePreviewOutputDto>(`${this.baseUrl}/Preview`, rule);
  }
}
