import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { PaginatedResult } from '../models/outputs/paginated-result-output-dto';
import {
  TaskCountsDto,
  TaskDto,
  TaskLinkDto,
  TaskSummaryDto,
} from '../models/outputs/task-output-dto';
import {
  CreateTaskInputDto,
  TaskDetailsInputDto,
  TaskLinkInputDto,
  TaskListQuery,
} from '../models/inputs/task-input-dto';

/** The Tasks module of Hestia.Api. A read-only user can call the GET endpoints only (403 otherwise). */
@Injectable({
  providedIn: 'root',
})
export class TaskRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/tasks`;

  /** A page of tasks: by due date (tasks without one last), then the manual order. */
  list(query: TaskListQuery = {}): Observable<PaginatedResult<TaskSummaryDto>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') params = params.set(key, value);
    }
    return this.http.get<PaginatedResult<TaskSummaryDto>>(this.baseUrl, { params });
  }

  /** The counts of open tasks due today, overdue and upcoming, with the server's "today". */
  summary(): Observable<TaskCountsDto> {
    return this.http.get<TaskCountsDto>(`${this.baseUrl}/summary`);
  }

  /** The tasks linked to one thing, for example a document (`Documents.Document`). */
  listByLink(kind: string, id: string): Observable<TaskSummaryDto[]> {
    const params = new HttpParams().set('kind', kind).set('id', id);
    return this.http.get<TaskSummaryDto[]>(`${this.baseUrl}/by-link`, { params });
  }

  /** One task, with its last 10 completions. */
  get(id: string): Observable<TaskDto> {
    return this.http.get<TaskDto>(`${this.baseUrl}/${id}`);
  }

  create(task: CreateTaskInputDto): Observable<TaskDto> {
    return this.http.post<TaskDto>(this.baseUrl, task);
  }

  /** Replaces all details. The status, the completions and the links stay. */
  update(id: string, details: TaskDetailsInputDto): Observable<TaskDto> {
    return this.http.put<TaskDto>(`${this.baseUrl}/${id}`, details);
  }

  /** Deletes the task, its completions and its links. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Marks the task done. A repeated task stays open, with its next due date. 409 for a task that is done already. */
  done(id: string): Observable<TaskDto> {
    return this.http.post<TaskDto>(`${this.baseUrl}/${id}/done`, null);
  }

  /** Undoes the last "done". 409 when there is nothing to undo. */
  undo(id: string): Observable<TaskDto> {
    return this.http.post<TaskDto>(`${this.baseUrl}/${id}/undo`, null);
  }

  /** Links the task to a document or a transaction. The host checks that the thing exists. */
  addLink(id: string, link: TaskLinkInputDto): Observable<TaskLinkDto> {
    return this.http.post<TaskLinkDto>(`${this.baseUrl}/${id}/links`, link);
  }

  removeLink(id: string, linkId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/links/${linkId}`);
  }
}
