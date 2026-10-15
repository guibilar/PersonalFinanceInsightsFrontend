import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, map, of, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { JournalRepository } from '../../../core/api/journal-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { JournalEntryDto } from '../../../core/models/outputs/journal-output-dto';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { formatDay } from '../../../shared/utils/format';
import { keptValueOf } from '../../../shared/utils/resource-value';
import {
  JOURNAL_LIMITS,
  dayNumber,
  dayOrNull,
  journalError,
  longDay,
  onThisDayText,
  streakText,
  weekdayLetter,
} from '../journal';

/** How many entries the list shows; a search finds older ones. */
export const JOURNAL_LIST_SIZE = 50;

/**
 * The Journal (design canvas, "Journal"): the streak, the week, the entry of one day (today, or the day in the address,
 * `?day=2026-10-08`), "On this day" (the same day in earlier years), and all entries with a search (`?q=`). A read-only
 * user reads only.
 */
@Component({
  selector: 'app-journal-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ConfirmDialogComponent,
    ErrorStateComponent,
    SkeletonComponent,
  ],
  templateUrl: './journal-page.component.html',
  styleUrl: './journal-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalPageComponent {
  private readonly repository = inject(JournalRepository);
  private readonly dataChanges = inject(DataChangesService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly canWrite = inject(AuthService).canWrite;
  readonly limit = JOURNAL_LIMITS.text;

  readonly summaryResource = rxResource({
    params: () => this.dataChanges.version(),
    stream: () => this.repository.summary(),
  });
  readonly summary = keptValueOf(this.summaryResource);

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly term = computed(() => (this.query().get('q') ?? '').trim());

  /** The day of the editor: the day in the address (not after today), or today. Null until the summary loads. */
  readonly day = computed(() => {
    const today = this.summary()?.date;
    if (!today) return null;
    const asked = dayOrNull(this.query().get('day'));
    return asked && asked <= today ? asked : today;
  });
  readonly isToday = computed(() => this.day() !== null && this.day() === this.summary()?.date);

  /** An earlier day's entry, read from the server; null when the day has none (404). Not for today. */
  readonly earlierResource = rxResource({
    params: () => {
      const day = this.day();
      return day && !this.isToday() ? { day, version: this.dataChanges.version() } : undefined;
    },
    stream: ({ params }) =>
      this.repository
        .get(params.day)
        .pipe(
          catchError((error: unknown) =>
            error instanceof HttpErrorResponse && error.status === 404
              ? of(null)
              : throwError(() => error),
          ),
        ),
  });

  /**
   * The entry of the editor's day: today's comes with the summary; an earlier day's is read. Null when the day has none,
   * undefined while it loads.
   */
  readonly entry = computed<JournalEntryDto | null | undefined>(() => {
    if (this.isToday()) return this.summary()?.today ?? null;
    return this.earlierResource.hasValue() ? this.earlierResource.value() : undefined;
  });

  /** The error of the entry: only an earlier day's entry loads on its own. */
  readonly entryError = computed(() => !this.isToday() && !!this.earlierResource.error());

  readonly listResource = rxResource({
    params: () => ({ q: this.term(), version: this.dataChanges.version() }),
    stream: ({ params }) =>
      this.repository.list({ q: params.q || null, page: 1, pageSize: JOURNAL_LIST_SIZE }),
  });
  readonly list = keptValueOf(this.listResource);

  readonly text = new FormControl('', { nonNullable: true });
  private readonly textValue = toSignal(this.text.valueChanges, { initialValue: '' });
  readonly changed = computed(() => this.textValue().trim() !== (this.entry()?.text ?? ''));
  readonly saving = signal(false);
  readonly confirmingDelete = signal(false);

  readonly search = new FormControl(this.term(), { nonNullable: true });

  constructor() {
    // A new day (or its entry loaded): the editor shows its text.
    effect(() => {
      const entry = this.entry();
      if (entry === undefined) return;
      this.text.setValue(entry?.text ?? '');
    });
    effect(() => (this.canWrite() ? this.text.enable() : this.text.disable()));

    this.search.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((q) =>
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { q: q || null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        }),
      );
  }

  streak(streak: number): string | null {
    return streakText(streak);
  }

  dayTitle(day: string): string {
    return longDay(day, this.summary()?.date ?? day);
  }

  letter(day: string): string {
    return weekdayLetter(day);
  }

  number(day: string): number {
    return dayNumber(day);
  }

  shortDay(day: string): string {
    return formatDay(day);
  }

  ago(day: string, yearsAgo: number): string {
    return onThisDayText(day, yearsAgo);
  }

  /** The address of a day: today has none. */
  dayParams(day: string): { day: string | null } {
    return { day: day === this.summary()?.date ? null : day };
  }

  save(): void {
    const day = this.day();
    const text = this.text.value.trim();
    if (!day || !text || this.saving()) return;
    this.saving.set(true);
    this.repository.save(day, text).subscribe({
      next: () => {
        this.saving.set(false);
        this.dataChanges.changed();
        this.toasts.success('Saved');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.toasts.error(journalError(error, 'Could not save the entry.'));
      },
    });
  }

  confirmDelete(): void {
    const day = this.day();
    if (!day) return;
    this.saving.set(true);
    this.repository.delete(day).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmingDelete.set(false);
        this.dataChanges.changed();
        this.toasts.success('Deleted the entry');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.confirmingDelete.set(false);
        this.toasts.error(journalError(error, 'Could not delete the entry.'));
      },
    });
  }
}
