import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { CalendarRepository } from '../../../core/api/calendar-repository';
import { CalendarEventRequest } from '../../../core/models/inputs/calendar-input-dto';
import { CalendarEventDto } from '../../../core/models/outputs/calendar-output-dto';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import {
  CALENDAR_LIMITS,
  REPEAT_PRESETS,
  addDays,
  calendarError,
  isoDay,
  joinRepeat,
  shortDay,
  splitRepeat,
} from '../calendar';

/** What the dialog shows: a new event on a day, or an event (and the occurrence that was clicked, for a repeated one). */
export interface EventDialogTarget {
  event: CalendarEventDto | null;
  /** For a new event: its first day. */
  day?: string;
  /** For a repeated event: the day of the occurrence that was clicked, to skip it. */
  occurrence?: string | null;
}

/** The value of the repeat select for a rule that the presets do not have (an imported event). */
const CUSTOM = 'custom';

/** "HH:mm" of a moment, in the browser's zone. */
function localTime(moment: string): string {
  const date = new Date(moment);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** The moment of a local day and time, as ISO. */
function moment(day: string, time: string): string {
  return new Date(`${day}T${time || '00:00'}:00`).toISOString();
}

/**
 * Adds or changes an event of the Calendar (T104): all day or with a time, a place, notes, and a repeat. For a repeated
 * event opened from one occurrence, "Skip this one" skips only that day. A read-only user only reads.
 */
@Component({
  selector: 'app-event-dialog',
  imports: [ReactiveFormsModule, ModalComponent, ConfirmDialogComponent],
  templateUrl: './event-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventDialogComponent implements OnInit {
  private readonly repository = inject(CalendarRepository);
  private readonly toasts = inject(ToastService);
  readonly canWrite = inject(AuthService).canWrite;

  readonly target = input.required<EventDialogTarget>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  readonly limits = CALENDAR_LIMITS;
  readonly presets = REPEAT_PRESETS;
  readonly custom = CUSTOM;
  readonly shortDay = shortDay;

  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    allDay: new FormControl(false, { nonNullable: true }),
    startDate: new FormControl('', { nonNullable: true }),
    startTime: new FormControl('09:00', { nonNullable: true }),
    endDate: new FormControl('', { nonNullable: true }),
    endTime: new FormControl('10:00', { nonNullable: true }),
    location: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
    repeat: new FormControl('', { nonNullable: true }),
    until: new FormControl('', { nonNullable: true }),
  });
  readonly allDay = toSignal(this.form.controls.allDay.valueChanges, { initialValue: false });
  readonly repeatValue = toSignal(this.form.controls.repeat.valueChanges, { initialValue: '' });

  readonly event = computed(() => this.target().event);
  readonly title = computed(() =>
    this.event() ? (this.canWrite() ? 'Edit event' : 'Event') : 'New event',
  );
  /** The rule of an imported event that the presets do not have: kept as it is unless the user picks another. */
  private customRule: string | null = null;
  readonly hasCustom = signal(false);
  readonly saving = signal(false);
  readonly confirmingDelete = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const event = this.target().event;
    if (!event) {
      const day = this.target().day ?? isoDay(new Date());
      this.form.patchValue({ startDate: day, endDate: day });
    } else {
      const { rule, until } = splitRepeat(event.repeat);
      const preset = REPEAT_PRESETS.some((p) => p.rule === rule);
      this.customRule = preset ? null : event.repeat;
      this.hasCustom.set(!preset);
      this.form.patchValue({
        title: event.title,
        allDay: event.allDay,
        startDate: event.allDay ? (event.startDate ?? '') : isoDay(new Date(event.startsAt!)),
        startTime: event.startsAt ? localTime(event.startsAt) : '09:00',
        endDate: event.allDay
          ? (event.endDate ?? '')
          : isoDay(new Date(event.endsAt ?? event.startsAt!)),
        endTime: event.endsAt ? localTime(event.endsAt) : '10:00',
        location: event.location ?? '',
        notes: event.notes ?? '',
        repeat: preset ? rule : CUSTOM,
        until: until ?? '',
      });
    }
    if (!this.canWrite()) this.form.disable();
  }

  /** The start moved: the end keeps its length (the same day for one day). */
  startChanged(): void {
    const { startDate, endDate } = this.form.getRawValue();
    if (startDate && (!endDate || endDate < startDate))
      this.form.controls.endDate.setValue(startDate);
  }

  request(): CalendarEventRequest | null {
    const v = this.form.getRawValue();
    const title = v.title.trim();
    if (!title) {
      this.error.set('Give the event a title.');
      return null;
    }
    if (!v.startDate) {
      this.error.set('Choose the day.');
      return null;
    }
    const endDate = v.endDate || v.startDate;
    const repeat =
      v.repeat === CUSTOM ? this.customRule : joinRepeat(v.repeat, v.until || null, v.allDay);
    if (v.allDay) {
      if (endDate < v.startDate) {
        this.error.set('The last day cannot be before the first day.');
        return null;
      }
      return {
        title,
        allDay: true,
        startDate: v.startDate,
        endDate,
        location: v.location.trim() || null,
        notes: v.notes.trim() || null,
        repeat,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }
    const startsAt = moment(v.startDate, v.startTime);
    const endsAt = moment(endDate, v.endTime || v.startTime);
    if (endsAt < startsAt) {
      this.error.set('The end cannot be before the start.');
      return null;
    }
    return {
      title,
      allDay: false,
      startsAt,
      endsAt,
      location: v.location.trim() || null,
      notes: v.notes.trim() || null,
      repeat,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  save(): void {
    this.error.set(null);
    const request = this.request();
    if (!request) return;
    const event = this.event();
    this.run(
      event ? this.repository.updateEvent(event.id, request) : this.repository.createEvent(request),
      'Could not save the event.',
      () => this.toasts.success(event ? 'Event saved.' : 'Event added.'),
    );
  }

  skip(): void {
    const event = this.event();
    const day = this.target().occurrence;
    if (!event || !day) return;
    this.run(this.repository.skip(event.id, day), 'Could not skip the day.', () =>
      this.toasts.success(`${event.title} skipped on ${shortDay(day)}.`),
    );
  }

  remove(): void {
    const event = this.event();
    this.confirmingDelete.set(false);
    if (!event) return;
    this.run(this.repository.deleteEvent(event.id), 'Could not delete the event.', () =>
      this.toasts.success('Event deleted.'),
    );
  }

  private run(call: Observable<unknown>, fallback: string, done: () => void): void {
    this.saving.set(true);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        done();
        this.saved.emit();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(calendarError(error, fallback));
      },
    });
  }

  /** The day after the start, for the "until" field's minimum. */
  minUntil(): string {
    return addDays(this.form.controls.startDate.value || isoDay(new Date()), 1);
  }
}
