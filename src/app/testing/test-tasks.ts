import { TaskCountsDto, TaskDto, TaskSummaryDto } from '../core/models/outputs/task-output-dto';
import { PaginatedResult } from '../core/models/outputs/paginated-result-output-dto';

export const TASK_ID = '0199f1a0-4444-7000-8000-000000000004';
export const TODAY = '2026-10-14';

/** An open task due today, without a repeat, tags, or links. */
export function testTask(changes: Partial<TaskDto> = {}): TaskDto {
  return {
    id: TASK_ID,
    title: 'Buy printer paper',
    notes: null,
    dueOn: TODAY,
    tags: [],
    status: 'Open',
    doneAt: null,
    repeat: null,
    sortOrder: null,
    lastDoneAt: null,
    createdAt: '2026-10-10T15:00:00Z',
    updatedAt: '2026-10-10T15:00:00Z',
    links: [],
    completions: [],
    ...changes,
  };
}

export function testTaskSummary(changes: Partial<TaskSummaryDto> = {}): TaskSummaryDto {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { completions, ...summary } = testTask();
  return { ...summary, ...changes };
}

export function testCounts(changes: Partial<TaskCountsDto> = {}): TaskCountsDto {
  return { date: TODAY, dueToday: 1, overdue: 0, upcoming: 0, ...changes };
}

export function testTaskPage(items: TaskSummaryDto[], totalCount = items.length) {
  return {
    items,
    page: 1,
    pageSize: 100,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / 100)),
    hasPreviousPage: false,
    hasNextPage: totalCount > 100,
  } satisfies PaginatedResult<TaskSummaryDto>;
}
