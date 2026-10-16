import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, UrlTree } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { InboxRepository } from '../../core/api/inbox-repository';
import { TaskRepository } from '../../core/api/task-repository';
import { TodayRepository } from '../../core/api/today-repository';
import { DataChangesService } from '../../core/data/data-changes.service';
import {
  TodayAgendaItem,
  TodayCard,
  TodayMemoryDto,
  TodayModuleStatus,
  TodaySeverity,
} from '../../core/models/outputs/today-output-dto';
import { CalendarItem } from '../../core/models/outputs/calendar-output-dto';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { validationDetail } from '../../shared/utils/problem-detail';
import { formatDay } from '../../shared/utils/format';
import { accentOf, itemIcon, shortDay, timeOf } from '../calendar/calendar';
import { AppModule, MODULES } from '../../core/modules/module-registry';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { StatCardComponent, StatTone } from '../../shared/ui/stat-card/stat-card.component';
import { keptValueOf } from '../../shared/utils/resource-value';
import { AuthService } from '../../core/auth/auth.service';
import { fillTodayText, formatTodayValue } from './today-text';
import { AttentionListComponent } from './attention-list/attention-list.component';

/** One module on Today, with its tiles. */
interface ModuleSection {
  /** The registry id ("money"), or the server name in lower case for a module the registry does not know. */
  id: string;
  name: string;
  /** The module home, when the registry has the module and it is active. */
  route: string | null;
  /** The module's icon, beside its name. */
  icon: IconName;
  status: TodayModuleStatus;
  tiles: TodayCard[];
}

/** The module of the server's own alerts (T80): no tiles, and last on Today. */
const SYSTEM_MODULE = 'system';

/** Tile icons by card kind. A kind not in the list gets the module icon. */
const TILE_ICONS: Record<string, IconName> = {
  spent: 'calendar',
  'left-over': 'wallet',
  'net-worth': 'trending-up',
  budgets: 'budgets',
};

const TONES: Record<TodaySeverity, StatTone> = {
  Neutral: 'neutral',
  Good: 'good',
  Warning: 'warning',
  Bad: 'bad',
};

/** A Today agenda item as a Calendar item, for the Calendar's helpers (icons, colours, times). */
function asCalendarItem(item: TodayAgendaItem): CalendarItem {
  return { ...item, recurring: false };
}

/** The path and the query of a web link ("/calendar?event=e1"), for routerLink and queryParams. */
export function splitLink(link: string | null): {
  path: string | null;
  query: Record<string, string>;
} {
  if (!link || !link.startsWith('/') || link.startsWith('//')) return { path: null, query: {} };
  const [path, search = ''] = link.split('#')[0].split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(search)) };
}

/**
 * Today (T106): the day first. "Your day" has the Calendar of today (events, tasks due with a box to tick, birthdays) and
 * what comes up this week; then "Needs attention"; beside them, the tiles of all modules at a glance and "On this day".
 * A note can be jotted down for the Inbox at the top. The server owns the card rules (`GET /api/today`); this page only
 * fills the text placeholders with the app's formats (and privacy mode).
 */
@Component({
  selector: 'app-today',
  imports: [
    RouterLink,
    AttentionListComponent,
    ErrorStateComponent,
    IconComponent,
    SkeletonComponent,
    StatCardComponent,
  ],
  templateUrl: './today.component.html',
  styles: `
    .today-date {
      font-size: 0.8125rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--accent, var(--bs-primary-text-emphasis));
    }

    .greeting {
      font-size: clamp(1.75rem, 1.2rem + 2vw, 2.5rem);
      font-weight: 600;
      color: var(--bs-emphasis-color);
    }

    .today-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1.5rem;
    }

    @media (min-width: 992px) {
      .today-layout {
        grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
        align-items: start;
      }
    }

    .capture {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.375rem 0.375rem 0.875rem;
      border: 1px solid var(--bs-border-color);
      border-radius: 999px;
      background: var(--bs-body-bg);

      &:focus-within {
        border-color: var(--bs-primary);
        box-shadow: 0 0 0 0.2rem rgba(var(--bs-primary-rgb), 0.15);
      }
    }

    .capture-icon {
      color: var(--bs-secondary-color);
    }

    .capture-input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--bs-body-color);
    }

    .capture .btn {
      border-radius: 999px;
    }

    .day-card {
      padding: 1.25rem;
      border: 1px solid var(--bs-border-color-translucent);
      border-radius: var(--bs-border-radius-xl);
      background: var(--bs-body-bg);
    }

    .agenda-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border-left: 4px solid var(--accent);
      border-radius: var(--bs-border-radius);
      background: var(--bs-tertiary-bg);

      &.done .agenda-title {
        text-decoration: line-through;
        color: var(--bs-secondary-color);
      }
    }

    .agenda-icon {
      display: inline-flex;
      padding: 0.375rem;
      border-radius: 50%;
      background: var(--accent-bg);
      color: var(--accent);
    }

    .agenda-check {
      width: 1.25rem;
      height: 1.25rem;
      margin: 0 0.25rem;
      flex-shrink: 0;
    }

    .agenda-text {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      color: inherit;
      text-decoration: none;

      &:hover .agenda-title {
        text-decoration: underline;
      }
    }

    .agenda-title {
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .agenda-meta {
      font-size: 0.8125rem;
      color: var(--bs-secondary-color);
    }

    .agenda-time {
      font-weight: 600;
      color: var(--accent);
      white-space: nowrap;
    }

    .upcoming-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--bs-secondary-color);
    }

    .upcoming-row {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.3125rem 0;
      color: inherit;
      text-decoration: none;

      &:hover .upcoming-text {
        text-decoration: underline;
      }
    }

    .upcoming-day {
      flex: 0 0 7.5rem;
      font-size: 0.8125rem;
      color: var(--bs-secondary-color);
    }

    .dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--accent);
    }

    .upcoming-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .glance-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
      gap: 0.75rem;
    }

    .memory {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.875rem 1rem;
      border-radius: var(--bs-border-radius-lg);
      background: var(--accent-bg);
      color: var(--bs-body-color);
      text-decoration: none;
      font-family: Georgia, 'Times New Roman', serif;
    }

    .memory-when {
      font-family: var(--bs-body-font-family);
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent);
    }

    .section-icon {
      display: inline-flex;
      padding: 0.375rem;
      border-radius: 50%;
      background: var(--accent-bg);
      color: var(--accent);
    }

    .section-title {
      font-family: var(--hestia-display-font);
      font-size: 1.125rem;
      font-weight: 600;
      font-variation-settings: 'SOFT' 100;
    }

    .bell {
      line-height: 1;
    }
    .bell-count {
      position: absolute;
      top: -0.4rem;
      right: -0.4rem;
      font-size: 0.65rem;
    }
    .placeholder-card {
      border-style: dashed;
      background: transparent;
    }

    .module-icon {
      display: inline-flex;
      padding: 0.625rem;
      border-radius: var(--bs-border-radius-lg);
      background: var(--bs-secondary-bg);
      color: var(--bs-secondary-color);
    }

    // A tile that opens its page: the whole tile is the link.
    .stat-link {
      display: block;
      height: 100%;
      color: inherit;
      text-decoration: none;
      border-radius: var(--bs-card-border-radius);

      &:hover ::ng-deep .card {
        border-color: var(--bs-primary-border-subtle);
      }

      &:focus-visible {
        outline: 2px solid var(--bs-primary);
        outline-offset: 2px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayComponent {
  private readonly todayRepository = inject(TodayRepository);
  private readonly inbox = inject(InboxRepository);
  private readonly tasks = inject(TaskRepository);
  private readonly toasts = inject(ToastService);
  readonly canWrite = inject(AuthService).canWrite;
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  /** A statement or a transaction added from Capture loads the cards again. */
  private readonly dataChanges = inject(DataChangesService);

  /** Clicks on "Refresh". */
  private readonly refreshes = signal(0);
  /** The data version when the page opened: a later version means the data changed since. */
  private readonly firstVersion = this.dataChanges.version();

  /**
   * The cards. The first load can use the server's short cache. A refresh, or a change to the data from this app, asks
   * for a new answer (`refresh=true`): else the cache can show the cards from before the change.
   */
  readonly todayResource = rxResource({
    params: () => ({ version: this.dataChanges.version(), refreshes: this.refreshes() }),
    stream: ({ params }) =>
      this.todayRepository.get(params.refreshes > 0 || params.version !== this.firstVersion),
  });
  /** The last answer stays on the page while the next one loads, so a refresh does not flash the skeleton. */
  readonly today = keptValueOf(this.todayResource);

  /** "Good evening, Alex": by the time of day, with the user's name (none for the read-only token). */
  readonly greeting = computed(() => {
    const user = this.auth.user();
    const name = user && user.scope !== 'read-only' ? displayName(user.username) : '';
    const part = greetingFor(new Date().getHours());
    return name ? `${part}, ${name}` : part;
  });

  readonly dateLabel = computed(() => {
    const date = this.today()?.date;
    const day = date ? new Date(`${date.slice(0, 10)}T00:00:00`) : new Date();
    return day.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
  });

  /**
   * The modules with tiles (or a load problem), in server order, each with its tiles. A module with only "Needs attention"
   * items has no section: its items are in the one list below (T81). `System` (T80) goes last.
   */
  readonly sections = computed<ModuleSection[]>(() =>
    this.allSections()
      .filter((section) => section.tiles.length > 0 || section.status !== 'Complete')
      .sort((a, b) => Number(a.id === SYSTEM_MODULE) - Number(b.id === SYSTEM_MODULE)),
  );

  /** Every module of the answer, also one with no tiles. */
  private readonly allSections = computed<ModuleSection[]>(() => {
    const today = this.today();
    if (!today) return [];
    const names = today.modules.map((m) => m.module);
    for (const card of today.cards) {
      if (!names.includes(card.module)) names.push(card.module);
    }
    return names.map((name) => {
      const known = registryModule(name);
      return {
        id: known?.id ?? name.toLowerCase(),
        name: known?.name ?? name,
        route: known?.status === 'active' ? known.route : null,
        icon: known?.icon ?? 'layout-grid',
        status: today.modules.find((m) => m.module === name)?.status ?? 'Complete',
        tiles: today.cards.filter((card) => card.module === name && card.type === 'Tile'),
      };
    });
  });

  /** All "Needs attention" items, most pressing first (the server's order). */
  readonly attention = computed(() =>
    (this.today()?.cards ?? []).filter((card) => card.type === 'Attention'),
  );

  /** The bell's label (T69): how many items need attention. */
  readonly bellLabel = computed(() => {
    const count = this.attention().length;
    if (count === 0) return 'Nothing needs attention';
    return count === 1 ? '1 item needs attention' : `${count} items need attention`;
  });

  /** The bell (T69): to the "Needs attention" list, with the focus on its heading. */
  showAttention(): void {
    const heading = document.getElementById('today-attention');
    if (!heading) return;
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }

  /** Registry modules that are still to come and that the server has no cards for. */
  readonly comingSoon = computed(() => {
    const served = new Set(this.allSections().map((section) => section.id));
    return MODULES.filter((module) => module.status === 'coming-soon' && !served.has(module.id));
  });

  refresh(): void {
    this.refreshes.update((n) => n + 1);
  }

  // ---- T106: your day, jot, on this day ----

  /** "2 things today, and a birthday this week." */
  readonly daySummary = computed(() => {
    const agenda = this.today()?.agenda;
    if (!agenda) return 'Here is how things are at home today.';
    const count = agenda.today.length;
    const today =
      count === 0
        ? 'Nothing planned today'
        : count === 1
          ? '1 thing today'
          : `${count} things today`;
    const birthday = agenda.upcoming.some((i) => i.kind === 'birthday')
      ? ', and a birthday this week'
      : '';
    return `${today}${birthday}.`;
  });

  readonly jotText = signal('');
  readonly jotting = signal(false);

  /** Saves the note to the Inbox, to sort later. */
  jot(): void {
    const text = this.jotText().trim();
    if (!text || this.jotting()) return;
    this.jotting.set(true);
    this.inbox.add(text).subscribe({
      next: () => {
        this.jotting.set(false);
        this.jotText.set('');
        this.toasts.success('Saved to the Inbox.', { label: 'Open', route: '/inbox' });
        this.dataChanges.changed();
      },
      error: (error: unknown) => {
        this.jotting.set(false);
        this.toasts.error(validationDetail(error, 'Could not save the note.'));
      },
    });
  }

  /** The tasks ticked here, done before the next answer comes. */
  private readonly doneHere = signal<ReadonlySet<string>>(new Set());
  readonly busyTask = signal<string | null>(null);

  isDone(item: TodayAgendaItem): boolean {
    return item.done === true || this.doneHere().has(item.id);
  }

  /** Ticks a task due today: done on the server, then Today loads again. */
  complete(item: TodayAgendaItem): void {
    const id = splitLink(item.link).path?.split('/')[2];
    if (!id) return;
    this.busyTask.set(item.id);
    this.tasks.done(id).subscribe({
      next: () => {
        this.busyTask.set(null);
        this.doneHere.update((done) => new Set(done).add(item.id));
        this.toasts.success(`Done: ${item.title}`);
        this.dataChanges.changed();
      },
      error: (error: unknown) => {
        this.busyTask.set(null);
        this.toasts.error(validationDetail(error, 'Could not mark the task done.'));
      },
    });
  }

  accentOf(item: TodayAgendaItem): string {
    return accentOf(asCalendarItem(item));
  }

  iconOf(item: TodayAgendaItem): IconName {
    return itemIcon(asCalendarItem(item));
  }

  /** The second line: the place or the detail, or "until Sun, Oct 25" for several days. */
  metaOf(item: TodayAgendaItem): string {
    const parts: string[] = [];
    if (item.text) parts.push(item.text);
    if (item.endDate !== item.startDate) parts.push(`until ${shortDay(item.endDate)}`);
    if (item.kind === 'task-due') parts.push('Task');
    if (!item.allDay && item.endsAt && item.endsAt !== item.startsAt)
      parts.push(`until ${timeOf(item.endsAt)}`);
    return parts.join(' · ');
  }

  readonly timeOf = timeOf;

  routeOf(item: TodayAgendaItem): string | null {
    return splitLink(item.link).path;
  }

  queryOf(item: TodayAgendaItem): Record<string, string> {
    return splitLink(item.link).query;
  }

  routeOfLink(link: string | null): string | null {
    return splitLink(link).path;
  }

  queryOfLink(link: string | null): Record<string, string> {
    return splitLink(link).query;
  }

  /** "Tomorrow" or "Tue" (or "Tue, Oct 20" after this week), and the time for an event. */
  upcomingDay(item: TodayAgendaItem, today: string): string {
    const tomorrow = new Date(`${today}T12:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day =
      item.startDate === tomorrow.toISOString().slice(0, 10)
        ? 'Tomorrow'
        : new Date(`${item.startDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
    return !item.allDay && item.startsAt ? `${day} ${timeOf(item.startsAt)}` : day;
  }

  /** "1 year ago · Oct 16, 2025". */
  memoryWhen(memory: TodayMemoryDto): string {
    const ago = memory.yearsAgo === 1 ? '1 year ago' : `${memory.yearsAgo} years ago`;
    return `${ago} · ${formatDay(memory.day)}`;
  }

  /** The big value of a tile; "—" when the server does not know it. */
  valueText(card: TodayCard): string {
    return card.value ? formatTodayValue(card.value) : '—';
  }

  /** The tile hint or the attention sentence, with its values filled in. */
  text(card: TodayCard): string {
    return fillTodayText(card.text, card.values);
  }

  tone(card: TodayCard): StatTone {
    return TONES[card.severity] ?? 'neutral';
  }

  trendIcon(card: TodayCard): IconName | null {
    return card.trend === 'Up' ? 'trending-up' : card.trend === 'Down' ? 'trending-down' : null;
  }

  tileIcon(card: TodayCard): IconName {
    return TILE_ICONS[card.kind] ?? registryModule(card.module)?.icon ?? 'dashboard';
  }

  /**
   * The card link as a route of this app, with its query string and fragment. Only a path in this app ("/money/…")
   * becomes a link; anything else gives none.
   */
  linkOf(card: TodayCard): UrlTree | null {
    const link = card.link;
    if (!link || !link.startsWith('/') || link.startsWith('//')) return null;
    return this.router.parseUrl(link);
  }
}

function registryModule(serverName: string): AppModule | undefined {
  const id = serverName.toLowerCase();
  return MODULES.find((module) => module.id === id);
}

/** The part of the day, as people greet each other. */
export function greetingFor(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** A user name as a first name: "alex.smith" or "alex" → "Alex". */
export function displayName(username: string): string {
  const first = username.trim().split(/[\s._@-]+/)[0] ?? '';
  return first ? first[0].toUpperCase() + first.slice(1) : '';
}
