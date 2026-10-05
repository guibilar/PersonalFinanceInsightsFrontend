import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import {
  AccountBalanceInputDto,
  AccountInputDto,
  AccountUpdateInputDto,
} from '../models/inputs/account-input-dto';
import { AccountBalanceOutputDto, AccountOutputDto } from '../models/outputs/account-output-dto';

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

  /** Every account, chequing first, then savings, credit cards and investments, each by name. */
  getAll(): Observable<AccountOutputDto[]> {
    return this.http.get<AccountOutputDto[]>(this.baseUrl);
  }

  create(account: AccountInputDto): Observable<AccountOutputDto> {
    return this.http.post<AccountOutputDto>(this.baseUrl, account);
  }

  /** Renames the account, corrects its statement format, or sets its plan and room; the type can't change. */
  update(id: string, update: AccountUpdateInputDto): Observable<AccountOutputDto> {
    return this.http.put<AccountOutputDto>(`${this.baseUrl}/${id}`, update);
  }

  /** Deletes an account without transactions, and its balances. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** The balances entered for the account, newest first. */
  getBalances(id: string): Observable<AccountBalanceOutputDto[]> {
    return this.http.get<AccountBalanceOutputDto[]>(`${this.baseUrl}/${id}/Balances`);
  }

  /** Its balance at the end of a day, replacing one entered for that day before. */
  setBalance(id: string, balance: AccountBalanceInputDto): Observable<AccountBalanceOutputDto> {
    return this.http.post<AccountBalanceOutputDto>(`${this.baseUrl}/${id}/Balances`, balance);
  }

  deleteBalance(id: string, balanceId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/Balances/${balanceId}`);
  }
}
