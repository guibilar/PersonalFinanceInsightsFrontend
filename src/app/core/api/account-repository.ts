import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { AccountInputDto } from '../models/inputs/account-input-dto';
import { AccountOutputDto } from '../models/outputs/account-output-dto';

/**
 * The bank accounts statements are imported into (not the signed-in user's account, see AuthService).
 * Names are unique; only an account without transactions can be deleted (409 otherwise).
 */
@Injectable({
  providedIn: 'root',
})
export class AccountRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl: string = `${API_BASE_URL}/Accounts`;

  /** Every account, chequing first, then savings, then credit cards, each by name. */
  getAll(): Observable<AccountOutputDto[]> {
    return this.http.get<AccountOutputDto[]>(this.baseUrl);
  }

  create(account: AccountInputDto): Observable<AccountOutputDto> {
    return this.http.post<AccountOutputDto>(this.baseUrl, account);
  }

  /** The type can't change, so only the name is sent. */
  rename(id: string, name: string): Observable<AccountOutputDto> {
    return this.http.put<AccountOutputDto>(`${this.baseUrl}/${id}`, { name });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
