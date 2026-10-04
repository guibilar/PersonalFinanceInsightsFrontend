import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { CategorizedReportOutputDto } from '../models/outputs/categorized-report-output-dto';
import { CashFlowReportOutputDto } from '../models/outputs/cash-flow-report-output-dto';
import {
  MerchantsInputDto,
  TransactionBreakdownInputDto,
} from '../models/inputs/transaction-breakdown-input-dto';
import {
  MerchantTotalDto,
  TransactionBreakdownOutputDto,
} from '../models/outputs/transaction-breakdown-output-dto';
import { PaginatedResult } from '../models/outputs/paginated-result-output-dto';
import {
  RecurringReportDto,
  ReviewReportDto,
  SpendingForecastDto,
  UncategorisedReportDto,
} from '../models/outputs/insights-output-dto';

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

  /** A page of the merchants the list's criteria spent at, largest first; page 1 is the breakdown's top ones. */
  getMerchants(input: MerchantsInputDto): Observable<PaginatedResult<MerchantTotalDto>> {
    return this.http.post<PaginatedResult<MerchantTotalDto>>(`${this.baseUrl}/merchants`, input);
  }

  /** Subscriptions, bills and rent: payments that come again and again. */
  getRecurring(): Observable<RecurringReportDto> {
    return this.http.get<RecurringReportDto>(`${this.baseUrl}/recurring`);
  }

  /** Where this month's spending is heading, and each monthly and yearly budget. */
  getForecast(): Observable<SpendingForecastDto> {
    return this.http.get<SpendingForecastDto>(`${this.baseUrl}/forecast`);
  }

  /** Merchants left in Other because no rule names them. */
  getUncategorised(): Observable<UncategorisedReportDto> {
    return this.http.get<UncategorisedReportDto>(`${this.baseUrl}/uncategorised`);
  }

  /** A month, or a year without `month`; the last complete month without either. */
  getReview(year?: number, month?: number): Observable<ReviewReportDto> {
    const params: Record<string, number> = {};
    if (year !== undefined) params['year'] = year;
    if (month !== undefined) params['month'] = month;
    return this.http.get<ReviewReportDto>(`${this.baseUrl}/review`, { params });
  }
}
