import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, filter, map, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { TaskRepository } from '../../../core/api/task-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { TaskCountsService } from '../../../core/data/task-counts.service';
import { TaskDueFilter } from '../../../core/models/inputs/task-input-dto';
import { TaskSummaryDto } from '../../../core/models/outputs/task-output-dto';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { keptValueOf, valueOf } from '../../../shared/utils/resource-value';
import { TaskDoneService } from '../task-done.service';
import { TaskRowComponent } from '../task-row/task-row.component';
import {
  DONE_SHOWN,
  DUE_FILTERS,
  DUE_FILTER_LABELS,
  MAX_PAGE_SIZE,
  TASK_LIMITS,
  TaskSections,
  addDays,
  groupTasks,
  taskError,
} from '../tasks';

/** The choices of the quick add for the due date. */
export type QuickDue = 'today' | 'tomorrow' | 'next-week' | 'none' | 'pick';

export const QUICK_DUE_LABELS: readonly { value: QuickDue; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'next-week', label: 'In a week' },
  { value: 'none', label: 'No date' },
  { value: 'pick', label: 'Pick a day…' },
];

/** One section of open tasks, as the page shows it. */
interface Section {
  key: keyof TaskSections;
  title: string;
  tasks: TaskSummaryDto[];
  empty?: string;
}

/**
 * The tasks: a quick add field, then the open tasks in sections (Overdue, Today, Upcoming, Later and no date, and
 * Recurring), and the last done tasks, collapsed. A checkbox marks a task done; a toast offers "Undo". The tag filter
 * and the search are in the address (`/tasks?tag=garden&q=water`). `/tasks?due=overdue` shows only the overdue tasks
 * (the Today alert links there).
 */
@Component({
  selector: 'app-task-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ErrorStateComponent,
    IconComponent,
    SkeletonComponent,
    TaskRowComponent,
  ],
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskListComponent {
  private readonly repository = inject(TaskRepository);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  private readonly dataChanges = inject(DataChangesService);
  private readonly counts = inject(TaskCountsService);
  protected readonly doneService = inject(TaskDoneService);
  /** A read-only user (T60) gets no quick add, and the checkboxes are off. */
  readonly canWrite = inject(AuthService).canWrite;

  readonly quickDueLabels = QUICK_DUE_LABELS;
  readonly limits = TASK_LIMITS;
  /** Today in the server's time zone (it decides what is overdue). */
  readonly today = this.counts.today;

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly q = computed(() => this.params().get('q')?.trim() ?? '');
  readonly tag = computed(() => this.params().get('tag')?.trim().toLowerCase() ?? '');
  /** The `due` filter of the address, or null. An unknown value counts as none. */
  readonly due = computed<TaskDueFilter | null>(() => {
    const due = this.params().get('due');
    return DUE_FILTERS.find((d) => d === due) ?? null;
  });
  readonly dueLabel = computed(() => {
    const due = this.due();
    return due ? DUE_FILTER_LABELS[due] : '';
  });

  readonly search = new FormControl(this.route.snapshot.queryParamMap.get('q') ?? '', {
    nonNullable: true,
  });

  /** The open tasks (at most 100), with the filters. They load again after each change. */
  readonly openResource = rxResource({
    params: () => ({
      q: this.q(),
      tag: this.tag(),
      due: this.due(),
      version: this.dataChanges.version(),
    }),
    stream: ({ params }) =>
      this.repository.list({
        status: 'Open',
        q: params.q,
        tag: params.tag,
        due: params.due,
        page: 1,
        pageSize: MAX_PAGE_SIZE,
      }),
  });
  /** The last answer stays while the next one loads, so a "done" does not flash the page. */
  readonly open = keptValueOf(this.openResource);
  readonly sections = computed(() => groupTasks(this.open()?.items ?? [], this.today()));
  /** More open tasks than one page: the page says so. */
  readonly truncated = computed(() => (this.open()?.totalCount ?? 0) > MAX_PAGE_SIZE);

  /** The sections to show. With a `due` filter: only the due sections that have tasks. */
  readonly shown = computed<Section[]>(() => {
    const s = this.sections();
    const all: Section[] = [
      { key: 'overdue', title: 'Overdue', tasks: s.overdue },
      { key: 'today', title: 'Today', tasks: s.today, empty: 'Nothing is due today.' },
      { key: 'upcoming', title: 'Upcoming', tasks: s.upcoming },
      { key: 'later', title: 'Later and no date', tasks: s.later },
    ];
    if (this.due()) return all.filter((section) => section.tasks.length > 0);
    return all.filter((section) => section.tasks.length > 0 || section.empty);
  });
  readonly noOpenTasks = computed(() => (this.open()?.items.length ?? 0) === 0);

  /** "Done" is collapsed; it loads when it opens. */
  readonly doneOpen = signal(false);
  readonly doneResource = rxResource({
    params: () =>
      this.doneOpen() && !this.due()
        ? { q: this.q(), tag: this.tag(), version: this.dataChanges.version() }
        : undefined,
    stream: ({ params }) =>
      params
        ? this.repository
            .list({
              status: 'Done',
              q: params.q,
              tag: params.tag,
              page: 1,
              pageSize: MAX_PAGE_SIZE,
            })
            .pipe(
              // The API sorts by due date: the page sorts by the time they were done.
              map((page) =>
                [...page.items]
                  .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
                  .slice(0, DONE_SHOWN),
              ),
            )
        : of([]),
  });
  readonly doneTasks = keptValueOf(this.doneResource);

  /** The tags to filter by: those of the tasks on the page, and the one in the address. */
  readonly tags = computed(() => {
    const tags = new Set<string>();
    for (const task of this.open()?.items ?? []) task.tags.forEach((tag) => tags.add(tag));
    for (const task of valueOf(this.doneResource) ?? []) task.tags.forEach((tag) => tags.add(tag));
    if (this.tag()) tags.add(this.tag());
    return [...tags].sort();
  });

  // Quick add.
  readonly newTitle = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(TASK_LIMITS.title)],
  });
  readonly quickDue = signal<QuickDue>('today');
  readonly pickedDay = new FormControl('', { nonNullable: true });
  readonly adding = signal(false);

  constructor() {
    this.search.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        // Against the address, not the last value typed: the box is also cleared (or set) without an event, and
        // the same search typed again afterwards has to run.
        filter((q) => q !== this.q()),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((q) => this.setFilters({ q: q || null }));

    // Back or forward to another search: the box shows it.
    effect(() => {
      const q = this.q();
      untracked(() => {
        if (this.search.value.trim() !== q) this.search.setValue(q, { emitEvent: false });
      });
    });
  }

  isBusy(task: TaskSummaryDto): boolean {
    return this.doneService.busy().has(task.id);
  }

  toggle(task: TaskSummaryDto): void {
    this.doneService.toggle(task);
  }

  selectTag(tag: string | null): void {
    this.setFilters({ tag: tag || null });
  }

  clearSearch(): void {
    this.search.setValue('', { emitEvent: false });
    this.setFilters({ q: null });
  }

  setQuickDue(value: string): void {
    this.quickDue.set(value as QuickDue);
  }

  /** The due date of the quick add, from its menu. Null for "No date". */
  quickDueOn(): string | null {
    const today = this.today();
    switch (this.quickDue()) {
      case 'today':
        return today;
      case 'tomorrow':
        return addDays(today, 1);
      case 'next-week':
        return addDays(today, 7);
      case 'pick':
        return this.pickedDay.value || null;
      default:
        return null;
    }
  }

  /** Adds the typed title as a task. Enter in the field does the same. */
  add(): void {
    const title = this.newTitle.value.trim();
    if (!title || this.adding() || this.newTitle.invalid) return;
    this.adding.set(true);
    this.repository
      .create({ title, notes: null, dueOn: this.quickDueOn(), tags: [], repeat: null })
      .subscribe({
        next: (task) => {
          this.adding.set(false);
          this.newTitle.setValue('');
          this.quickDue.set('today');
          this.pickedDay.setValue('');
          this.dataChanges.changed();
          this.toasts.success(`Added “${task.title}”`, {
            label: 'Open',
            route: `/tasks/${task.id}`,
          });
        },
        error: (error: unknown) => {
          this.adding.set(false);
          this.toasts.error(taskError(error, 'Could not add the task.'));
        },
      });
  }

  reload(): void {
    this.openResource.reload();
  }

  private setFilters(changes: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
