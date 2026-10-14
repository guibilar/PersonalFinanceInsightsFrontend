import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { PaginatedResult } from '../models/outputs/paginated-result-output-dto';
import {
  HomeSummaryDto,
  ItemDto,
  ItemLinkDto,
  ItemSummaryDto,
  RoomDto,
} from '../models/outputs/home-output-dto';
import {
  CreateItemInputDto,
  ItemDetailsInputDto,
  ItemLinkInputDto,
  ItemListQuery,
  RoomInputDto,
} from '../models/inputs/home-input-dto';

/** The query values that the API takes, without the empty ones. */
function paramsOf(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') params = params.set(key, value);
  }
  return params;
}

/**
 * The Home module of Hestia.Api: rooms and items. A read-only user can call the GET endpoints only (403 otherwise),
 * also the export.
 */
@Injectable({
  providedIn: 'root',
})
export class HomeRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/home`;

  /** The item count, the total value, the count per room, and the warranties that end soon. */
  summary(): Observable<HomeSummaryDto> {
    return this.http.get<HomeSummaryDto>(`${this.baseUrl}/summary`);
  }

  /** All rooms, in list order, with their counts and values. */
  rooms(): Observable<RoomDto[]> {
    return this.http.get<RoomDto[]>(`${this.baseUrl}/rooms`);
  }

  /** 409 for a name that exists (in any letter case). */
  createRoom(room: RoomInputDto): Observable<RoomDto> {
    return this.http.post<RoomDto>(`${this.baseUrl}/rooms`, room);
  }

  updateRoom(id: string, room: RoomInputDto): Observable<RoomDto> {
    return this.http.put<RoomDto>(`${this.baseUrl}/rooms/${id}`, room);
  }

  /** 409 when the room has items. */
  deleteRoom(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/rooms/${id}`);
  }

  /** A new order: the ids of all rooms, each one time. The answer is the rooms in the new order. */
  orderRooms(roomIds: string[]): Observable<RoomDto[]> {
    return this.http.put<RoomDto[]>(`${this.baseUrl}/rooms/order`, { roomIds });
  }

  /** A page of items, by name (best match first with `q`). */
  list(query: ItemListQuery = {}): Observable<PaginatedResult<ItemSummaryDto>> {
    return this.http.get<PaginatedResult<ItemSummaryDto>>(`${this.baseUrl}/items`, {
      params: paramsOf(query),
    });
  }

  /** The items linked to one thing, from either side of the link: a document, a task, or a transaction. */
  listByLink(kind: string, id: string): Observable<ItemSummaryDto[]> {
    const params = new HttpParams().set('kind', kind).set('id', id);
    return this.http.get<ItemSummaryDto[]>(`${this.baseUrl}/items/by-link`, { params });
  }

  /** One item, with its documents and its maintenance tasks. */
  get(id: string): Observable<ItemDto> {
    return this.http.get<ItemDto>(`${this.baseUrl}/items/${id}`);
  }

  create(item: CreateItemInputDto): Observable<ItemDto> {
    return this.http.post<ItemDto>(`${this.baseUrl}/items`, item);
  }

  /** Replaces all details. The links stay. */
  update(id: string, details: ItemDetailsInputDto): Observable<ItemDto> {
    return this.http.put<ItemDto>(`${this.baseUrl}/items/${id}`, details);
  }

  /** Deletes the item and its links. The linked documents, tasks, and transactions stay. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/items/${id}`);
  }

  /** 409 for a link that exists; 502 when finance cannot check a transaction. */
  addLink(id: string, link: ItemLinkInputDto): Observable<ItemLinkDto> {
    return this.http.post<ItemLinkDto>(`${this.baseUrl}/items/${id}/links`, link);
  }

  removeLink(id: string, linkId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/items/${id}/links/${linkId}`);
  }

  /**
   * The address of the CSV export (`home-inventory-<date>.csv`), for a download link. The browser sends the session
   * cookie with it. A filter gives only the matching items.
   */
  exportUrl(query: Omit<ItemListQuery, 'page' | 'pageSize'> = {}): string {
    const params = paramsOf(query).toString();
    return `${this.baseUrl}/items/export.csv${params ? `?${params}` : ''}`;
  }
}
