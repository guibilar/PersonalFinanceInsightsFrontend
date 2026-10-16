import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth.service';
import { CalendarRepository } from '../../../core/api/calendar-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import {
  CalendarEventDto,
  CalendarImportResultDto,
  CalendarItem,
} from '../../../core/models/outputs/calendar-output-dto';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { keptValueOf } from '../../../shared/utils/resource-value';
import {
  CALENDAR_LIMITS,
  accentOf,
  addDays,
  addMonths,
  calendarError,
  dayHeading,
  isoDay,
  itemIcon,
  itemsOn,
  monthStart,
  monthTitle,
  monthWeeks,
  shortDay,
  timeOf,
  whenText,
} from '../calendar';
import { EventDialogComponent, EventDialogTarget } from '../event-dialog/event-dialog.component';

/** The views of the page. */
export type CalendarView = 'month' | 'agenda';

/** How many days the agenda view shows. */
export const AGENDA_DAYS = 60;

/** The most items a day cell of the month shows; the rest is "+2 more". */
export const CELL_ITEMS = 3;

/**
 * The Calendar (T104): a month with the items of each day, and the list of the chosen day; or the agenda (the next 60
 * days). The items are the events of the Calendar module and the dated things of the other modules (tasks, birthdays,
 * expiries). Events are added here, or imported from an `.ics` file. The address keeps the view
 * (`?view=agenda&month=2026-10&day=2026-10-20`); `?event=<id>` opens an event.
 */
@Component({
  selector: 'app-calendar-page',
  imports: [
    NgTemplateOutlet,
    ErrorStateComponent,
    IconComponent,
    ModalComponent,
    SkeletonComponent,
    EventDialogComponent,
  ],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPageComponent {
  private readonly repository = inject(CalendarRepository);
  private readonly dataChanges = inject(DataChangesService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly canWrite = inject(AuthService).canWrite;

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** Today in the browser's zone; the server's `today` wins once it is known. */
  private readonly localToday = isoDay(new Date());
  readonly view = computed<CalendarView>(() =>
    this.query().get('view') === 'agenda' ? 'agenda' : 'month',
  );
  /** The first day of the month on screen. */
  readonly month = computed(() => {
    const asked = this.query().get('month');
    return asked && /^\d{4}-\d{2}$/.test(asked) ? `${asked}-01` : monthStart(this.localToday);
  });
  readonly weeks = computed(() => monthWeeks(this.month()));
  /** The chosen day of the month view: the day in the address, or today. */
  readonly selected = computed(() => {
    const asked = this.query().get('day');
    return asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : this.localToday;
  });

  /** The days to load: the whole weeks of the month, or the agenda days from today. */
  private readonly range = computed(() => {
    if (this.view() === 'agenda')
      return { from: this.localToday, to: addDays(this.localToday, AGENDA_DAYS - 1) };
    const weeks = this.weeks();
    return { from: weeks[0][0], to: weeks[weeks.length - 1][6] };
  });

  readonly calendarResource = rxResource({
    params: () => ({ ...this.range(), version: this.dataChanges.version() }),
    stream: ({ params }) => this.repository.range(params.from, params.to),
  });
  readonly calendar = keptValueOf(this.calendarResource);
  /** Today for the highlights: the server's day once it is known (the range above uses the browser's day). */
  readonly today = computed<string>(() => this.calendar()?.today ?? this.localToday);
  readonly items = computed(() => this.calendar()?.items ?? []);
  readonly failedModules = computed(() =>
    (this.calendar()?.modules ?? []).filter((m) => m.status !== 'Complete').map((m) => m.module),
  );

  readonly selectedItems = computed(() => itemsOn(this.items(), this.selected()));
  /** The agenda: each day with items, in order. */
  readonly agenda = computed(() => {
    const days: { day: string; items: CalendarItem[] }[] = [];
    const { from, to } = this.range();
    for (let day = from; day <= to; day = addDays(day, 1)) {
      const items = itemsOn(this.items(), day);
      if (items.length > 0) days.push({ day, items });
    }
    return days;
  });

  /** The event dialog: a new event (with a day), or an event of the Calendar module (with the occurrence clicked). */
  readonly dialog = signal<EventDialogTarget | null>(null);

  readonly importing = signal(false);
  readonly importPreview = signal<{
    ics: string;
    fileName: string;
    result: CalendarImportResultDto;
  } | null>(null);

  readonly weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly cellItems = CELL_ITEMS;
  readonly monthTitle = monthTitle;
  readonly dayHeading = dayHeading;
  readonly shortDay = shortDay;
  readonly whenText = whenText;
  readonly timeOf = timeOf;
  readonly itemIcon = itemIcon;
  readonly accentOf = accentOf;
  readonly itemsOn = (day: string) => itemsOn(this.items(), day);

  constructor() {
    // A link to one event (`/calendar?event=<id>`, from Today, Search, or a list item) opens it.
    const eventId = this.route.snapshot.queryParamMap.get('event');
    if (eventId) this.openEvent(eventId, null);
  }

  // ---- Navigation ----

  setView(view: CalendarView): void {
    void this.router.navigate([], {
      queryParams: { view: view === 'month' ? null : view },
      queryParamsHandling: 'merge',
    });
  }

  goMonth(months: number): void {
    const month = addMonths(this.month(), months);
    void this.router.navigate([], {
      queryParams: { month: month.slice(0, 7), day: null },
      queryParamsHandling: 'merge',
    });
  }

  goToday(): void {
    void this.router.navigate([], {
      queryParams: { month: null, day: null },
      queryParamsHandling: 'merge',
    });
  }

  select(day: string): void {
    const inMonth = day.slice(0, 7) === this.month().slice(0, 7);
    void this.router.navigate([], {
      queryParams: { day, month: inMonth ? this.query().get('month') : day.slice(0, 7) },
      queryParamsHandling: 'merge',
    });
  }

  inMonth(day: string): boolean {
    return day.slice(0, 7) === this.month().slice(0, 7);
  }

  dayLabel(day: string): string {
    const count = this.itemsOn(day).length;
    return `${dayHeading(day, this.today())}${count ? `, ${count} item${count === 1 ? '' : 's'}` : ''}`;
  }

  // ---- Items ----

  /** An event of the Calendar module opens its dialog; another module's item opens its page. */
  open(item: CalendarItem): void {
    if (item.eventId) {
      this.openEvent(item.eventId, item);
    } else if (item.link) {
      void this.router.navigateByUrl(item.link);
    }
  }

  private openEvent(id: string, item: CalendarItem | null): void {
    this.repository.getEvent(id).subscribe({
      next: (event: CalendarEventDto) =>
        this.dialog.set({ event, occurrence: item?.recurring ? item.startDate : null }),
      error: (error: unknown) =>
        this.toasts.error(calendarError(error, 'Could not open the event.')),
    });
  }

  addEvent(day?: string): void {
    this.dialog.set({ event: null, day: day ?? this.selected() });
  }

  onSaved(): void {
    this.dialog.set(null);
    this.dataChanges.changed();
  }

  closeDialog(): void {
    this.dialog.set(null);
    if (this.query().get('event')) {
      void this.router.navigate([], { queryParams: { event: null }, queryParamsHandling: 'merge' });
    }
  }

  // ---- Import ----

  /** Reads the chosen `.ics` file and shows what the import would do. */
  async chooseFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > CALENDAR_LIMITS.icsBytes) {
      this.toasts.error('The file is too big (at most 5 MB).');
      return;
    }
    const ics = await file.text();
    this.importing.set(true);
    this.repository.import(ics, true).subscribe({
      next: (result) => {
        this.importing.set(false);
        this.importPreview.set({ ics, fileName: file.name, result });
      },
      error: (error: unknown) => {
        this.importing.set(false);
        this.toasts.error(calendarError(error, 'Could not read the file.'));
      },
    });
  }

  confirmImport(): void {
    const preview = this.importPreview();
    if (!preview) return;
    this.importing.set(true);
    this.repository.import(preview.ics, false).subscribe({
      next: (result) => {
        this.importing.set(false);
        this.importPreview.set(null);
        this.dataChanges.changed();
        this.toasts.success(importSummary(result));
        // Show the first new or changed event.
        const first = result.events.find(
          (e) => (e.action === 'Add' || e.action === 'Update') && (e.startDate || e.startsAt),
        );
        const day = first?.startDate ?? (first?.startsAt ? isoDay(new Date(first.startsAt)) : null);
        if (day) this.select(day);
      },
      error: (error: unknown) => {
        this.importing.set(false);
        this.toasts.error(calendarError(error, 'Could not import the file.'));
      },
    });
  }

  importSummary = importSummary;

  /** The changes of a preview: the events that the import adds, changes, or deletes. */
  importChanges(result: CalendarImportResultDto): number {
    return result.added + result.updated + result.deleted;
  }

  importWhen(event: CalendarImportResultDto['events'][number]): string {
    if (event.startsAt)
      return `${shortDay(isoDay(new Date(event.startsAt)))} · ${timeOf(event.startsAt)}`;
    return event.startDate ? `${shortDay(event.startDate)} · All day` : '';
  }
}

/** "2 events added, 1 changed." */
export function importSummary(result: CalendarImportResultDto): string {
  const parts: string[] = [];
  if (result.added) parts.push(`${result.added} event${result.added === 1 ? '' : 's'} added`);
  if (result.updated) parts.push(`${result.updated} changed`);
  if (result.deleted) parts.push(`${result.deleted} cancelled`);
  if (result.unchanged && parts.length === 0)
    parts.push(`${result.unchanged} already in the calendar`);
  if (result.skipped) parts.push(`${result.skipped} skipped`);
  return parts.length ? `${parts.join(', ')}.` : 'The file has no events.';
}
