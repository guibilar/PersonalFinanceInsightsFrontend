import { TaskRepeatDto, TaskStatus } from '../outputs/task-output-dto';

/**
 * The details of a task: for `POST /api/tasks`, and for `PUT /api/tasks/{id}`. A `PUT` replaces all of them: a value
 * that is not sent becomes empty. The status, the completions and the links do not change with a `PUT`.
 */
export interface TaskDetailsInputDto {
  title: string;
  notes: string | null;
  /** A day, `yyyy-MM-dd`, or null. A repeated task without one is due today. */
  dueOn: string | null;
  tags: string[];
  repeat: TaskRepeatDto | null;
  sortOrder?: number | null;
}

/** A new link: `Documents.Document` or `Money.Transaction`, with the id of the thing. */
export interface TaskLinkInputDto {
  kind: string;
  targetId: string;
}

/** A new task: its details, and links to make at once. */
export interface CreateTaskInputDto extends TaskDetailsInputDto {
  links?: TaskLinkInputDto[];
}

/** Which tasks the `due` filter keeps. `overdue` keeps open tasks only. */
export type TaskDueFilter = 'today' | 'overdue' | 'upcoming' | 'none';

/** The filters of the task list (`GET /api/tasks`). Empty values are not sent. No status: open and done. */
export interface TaskListQuery {
  status?: TaskStatus | null;
  tag?: string | null;
  due?: TaskDueFilter | null;
  /** Words in the title, the notes, or the tags. */
  q?: string | null;
  page?: number;
  /** 1 to 100. */
  pageSize?: number;
}
