import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { PaginatedResult } from '../models/outputs/paginated-result-output-dto';
import {
  GiftIdeaDto,
  GroupCountDto,
  InteractionDto,
  LoanDto,
  PeopleSummaryDto,
  PersonDto,
  PersonLinkDto,
  PersonSummaryDto,
} from '../models/outputs/people-output-dto';
import {
  CreatePersonInputDto,
  GiftIdeaInputDto,
  InteractionInputDto,
  LoanInputDto,
  LoanStatus,
  PersonDetailsInputDto,
  PersonLinkInputDto,
  PersonListQuery,
} from '../models/inputs/people-input-dto';

/** The query values that the API takes, without the empty ones. */
function paramsOf(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') params = params.set(key, value);
  }
  return params;
}

/**
 * The People module of Hestia.Api: people, contacts, gift ideas, loans, and links. A read-only user can call the GET
 * endpoints only (403 otherwise).
 */
@Injectable({
  providedIn: 'root',
})
export class PeopleRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/people`;

  /** Reach out, upcoming birthdays, and the loan counts. */
  summary(): Observable<PeopleSummaryDto> {
    return this.http.get<PeopleSummaryDto>(`${this.baseUrl}/summary`);
  }

  groups(): Observable<GroupCountDto[]> {
    return this.http.get<GroupCountDto[]>(`${this.baseUrl}/groups`);
  }

  list(query: PersonListQuery = {}): Observable<PaginatedResult<PersonSummaryDto>> {
    return this.http.get<PaginatedResult<PersonSummaryDto>>(this.baseUrl, {
      params: paramsOf(query),
    });
  }

  get(id: string): Observable<PersonDto> {
    return this.http.get<PersonDto>(`${this.baseUrl}/${id}`);
  }

  create(person: CreatePersonInputDto): Observable<PersonDto> {
    return this.http.post<PersonDto>(this.baseUrl, person);
  }

  /** Replaces all details. The records and the links stay. */
  update(id: string, details: PersonDetailsInputDto): Observable<PersonDto> {
    return this.http.put<PersonDto>(`${this.baseUrl}/${id}`, details);
  }

  /** Deletes the person with the contacts, the gift ideas, the loans, and the links. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  interactions(
    personId: string,
    page: number,
    pageSize: number,
  ): Observable<PaginatedResult<InteractionDto>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PaginatedResult<InteractionDto>>(
      `${this.baseUrl}/${personId}/interactions`,
      {
        params,
      },
    );
  }

  logInteraction(personId: string, interaction: InteractionInputDto): Observable<InteractionDto> {
    return this.http.post<InteractionDto>(`${this.baseUrl}/${personId}/interactions`, interaction);
  }

  deleteInteraction(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/interactions/${id}`);
  }

  addGift(personId: string, gift: GiftIdeaInputDto): Observable<GiftIdeaDto> {
    return this.http.post<GiftIdeaDto>(`${this.baseUrl}/${personId}/gifts`, gift);
  }

  /** Replaces all values; set `givenOn` when the gift was given. */
  updateGift(id: string, gift: GiftIdeaInputDto): Observable<GiftIdeaDto> {
    return this.http.put<GiftIdeaDto>(`${this.baseUrl}/gifts/${id}`, gift);
  }

  deleteGift(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/gifts/${id}`);
  }

  loans(status: LoanStatus = 'open'): Observable<LoanDto[]> {
    return this.http.get<LoanDto[]>(`${this.baseUrl}/loans`, { params: { status } });
  }

  addLoan(personId: string, loan: LoanInputDto): Observable<LoanDto> {
    return this.http.post<LoanDto>(`${this.baseUrl}/${personId}/loans`, loan);
  }

  /** Replaces all values; set `returnedOn` when the thing came back. */
  updateLoan(id: string, loan: LoanInputDto): Observable<LoanDto> {
    return this.http.put<LoanDto>(`${this.baseUrl}/loans/${id}`, loan);
  }

  deleteLoan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/loans/${id}`);
  }

  /** 409 for a link that exists; 502 when finance cannot check a transaction. */
  addLink(id: string, link: PersonLinkInputDto): Observable<PersonLinkDto> {
    return this.http.post<PersonLinkDto>(`${this.baseUrl}/${id}/links`, link);
  }

  removeLink(id: string, linkId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/links/${linkId}`);
  }

  /** The people linked to one thing, for example a home item. */
  listByLink(kind: string, id: string): Observable<PersonSummaryDto[]> {
    const params = new HttpParams().set('kind', kind).set('id', id);
    return this.http.get<PersonSummaryDto[]>(`${this.baseUrl}/by-link`, { params });
  }
}
