import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { CategorizedReportOutputDto } from '../models/outputs/categorized-report-output-dto';
import { CashFlowReportOutputDto } from '../models/outputs/cash-flow-report-output-dto';
import { TransactionBreakdownInputDto } from '../models/inputs/transaction-breakdown-input-dto';
import { TransactionBreakdownOutputDto } from '../models/outputs/transaction-breakdown-output-dto';

@Injectable({
  providedIn: 'root',
})
export class ReportsRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl: string = `${API_BASE_URL}/Reports`;

  getMonthlyCategorizedGraph(): Observable<CategorizedReportOutputDto> {
    return this.http.get<CategorizedReportOutputDto>(`${this.baseUrl}/monthly-categorized-graph`);
  }

  getCurrentMonthCategorizedGraph(): Observable<CategorizedReportOutputDto> {
    return this.http.get<CategorizedReportOutputDto>(
      `${this.baseUrl}/current-month-categorized-graph`,
    );
  }

  /** Income, spending and savings per month of the current year, with monthly averages. */
  getCashFlow(): Observable<CashFlowReportOutputDto> {
    return this.http.get<CashFlowReportOutputDto>(`${this.baseUrl}/cash-flow`);
  }

  /** Totals for what the list's criteria pick, per week, month, quarter or year, with running totals. */
  getBreakdown(input: TransactionBreakdownInputDto): Observable<TransactionBreakdownOutputDto> {
    return this.http.post<TransactionBreakdownOutputDto>(`${this.baseUrl}/breakdown`, input);
  }
}
