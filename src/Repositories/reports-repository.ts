import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReportsRepository {
  private readonly baseUrl: string = `${environment.apiUrl}/Reports`;

  constructor(private http: HttpClient) {}

  getMonthlyCategorizedGraph(): Observable<any> {
    return this.http.get(`${this.baseUrl}/monthly-categorized-graph`);
  }

  getCurrentMonthCategorizedGraph(): Observable<any> {
    return this.http.get(`${this.baseUrl}/current-month-categorized-graph`);
  }
}
