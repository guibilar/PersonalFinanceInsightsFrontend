import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { TransactionFilterInputDto } from '../Models/Inputs/transaction-filter-input-dto';
import { TransactionOutputDto } from '../Models/Outputs/transaction-output-dto';
import {PaginatedResult} from '../Models/Outputs/paginated-result-output-dto';
import {TransactionLinkingInputDto} from '../Models/Inputs/transaction-input-dto';

@Injectable({
  providedIn: 'root'
})
export class TransactionRepository {
  private readonly baseUrl: string = `${environment.apiUrl}/Transaction`;

  constructor(private http: HttpClient) {}
  linkTransaction(linkingTransactionInputDto: TransactionLinkingInputDto): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/LinkTransaction`, linkingTransactionInputDto);
  }

  unlinkTransaction(id: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/UnlinkTransaction/${id}`, null);
  }
  filter(filterDto: TransactionFilterInputDto): Observable<PaginatedResult<TransactionOutputDto>> {
    return this.http.post<PaginatedResult<TransactionOutputDto>>(`${this.baseUrl}/Filter`, filterDto);
  }
}
