import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { AccountInputDto, AccountUpdateInputDto } from '../models/inputs/account-input-dto';
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

  /** Renames the account and/or corrects its statement format; the type can't change. */
  update(id: string, update: AccountUpdateInputDto): Observable<AccountOutputDto> {
    return this.http.put<AccountOutputDto>(`${this.baseUrl}/${id}`, update);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
