import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ReportsRepository {
  private readonly baseUrl: string = 'http://localhost:5096/api/Reports';

  constructor(private http: HttpClient) {}

  getMonthlyCategorizedGraph(): Observable<any> {
    return this.http.get(`${this.baseUrl}/monthly-categorized-graph`);
  }

  getCurrentMonthCategorizedGraph(): Observable<any> {
    return this.http.get(`${this.baseUrl}/current-month-categorized-graph`);
  }
}
