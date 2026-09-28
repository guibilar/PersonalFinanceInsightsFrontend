import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { CategorizedReportOutputDto } from '../models/outputs/categorized-report-output-dto';
import { CashFlowReportOutputDto } from '../models/outputs/cash-flow-report-output-dto';

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
}
