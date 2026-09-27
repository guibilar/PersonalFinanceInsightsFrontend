import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { CategorizedReportOutputDto } from '../models/outputs/categorized-report-output-dto';

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
}
