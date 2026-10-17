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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TimelineRepository } from '../../../core/api/timeline-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import {
  TimelineDayDto,
  TimelineDto,
  TimelineEntry,
} from '../../../core/models/outputs/timeline-output-dto';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { IconComponent, IconName } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { formatCurrency } from '../../../shared/utils/format';
import { plainClick } from '../../../shared/utils/links';
import {
  TIMELINE_FILTERS,
  TIMELINE_PAGE_DAYS,
  dayHeading,
  entryIcon,
  entryTime,
} from '../timeline';

/**
 * The Timeline (design canvas, "Timeline"): what happened in all modules, day by day, newest first. The module chips
 * filter it (`/timeline?module=Money`); "Show earlier" loads the 14 days before. A tap on an entry opens its page.
 */
@Component({
  selector: 'app-timeline-page',
  imports: [RouterLink, ErrorStateComponent, IconComponent, SkeletonComponent],
  templateUrl: './timeline-page.component.html',
  styleUrl: './timeline-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelinePageComponent {
  private readonly repository = inject(TimelineRepository);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly filters = TIMELINE_FILTERS;
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  /** The module of the filter, as the server names it, or null for all. */
  readonly module = computed(() => {
    const asked = this.query().get('module');
    return (
      TIMELINE_FILTERS.find(
        (f) => f.module !== null && f.module.toLowerCase() === asked?.toLowerCase(),
      )?.module ?? null
    );
  });

  /** The pages loaded so far, newest first. */
  readonly pages = signal<TimelineDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  private request?: Subscription;

  readonly today = computed(() => this.pages()[0]?.today ?? null);
  /** The days of all pages, newest first. */
  readonly days = computed<TimelineDayDto[]>(() => this.pages().flatMap((page) => page.days));
  /** The modules that failed or are partial on any page loaded. */
  readonly failed = computed(() => this.problems('Failed'));
  readonly partial = computed(() => this.problems('Partial'));
  /** The first day loaded: what "Show earlier" goes before. */
  readonly loadedFrom = computed(() => this.pages().at(-1)?.from ?? null);

  constructor() {
    // The first page, again when the filter changes or something changes in any module (data changes).
    const dataChanges = inject(DataChangesService);
    effect(() => {
      this.module();
      dataChanges.version();
      untracked(() => this.reload());
    });
  }

  private problems(status: 'Failed' | 'Partial'): string[] {
    const modules = new Set<string>();
    for (const page of this.pages()) {
      for (const m of page.modules) if (m.status === status) modules.add(m.module);
    }
    return [...modules].sort();
  }

  /** The first page again (the filter changed, or "Try again"). */
  reload(): void {
    this.pages.set([]);
    this.load(null);
  }

  /** False when the last page says that no module has anything earlier. */
  readonly hasEarlier = computed(() => this.pages().at(-1)?.hasEarlier !== false);

  showEarlier(): void {
    if (!this.hasEarlier()) return;
    const before = this.pages().at(-1)?.earlier;
    if (before && !this.loading()) this.load(before);
  }

  private load(before: string | null): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    this.request = this.repository
      .page({ before, days: TIMELINE_PAGE_DAYS, module: this.module() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.pages.update((pages) => [...pages, page]);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  filterParams(module: string | null): { module: string | null } {
    return { module };
  }

  heading(day: string): string {
    return dayHeading(day, this.today() ?? day);
  }

  icon(entry: TimelineEntry): IconName {
    return entryIcon(entry);
  }

  time(entry: TimelineEntry): string {
    return entryTime(entry);
  }

  amount(entry: TimelineEntry): string {
    return entry.amount === null ? '' : formatCurrency(entry.amount);
  }

  /** The module of an entry as a CSS name, for its colour: "money", "documents", … */
  tone(entry: TimelineEntry): string {
    return entry.module.toLowerCase();
  }

  /** Opens the page of an entry: its link has a query (`/money/transactions?id=…`), so it goes to the router as a URL. */
  open(event: Event, entry: TimelineEntry): void {
    // Ctrl or Cmd and the like: the browser opens the link's href in a new tab.
    if (!entry.link || !plainClick(event)) return;
    event.preventDefault();
    void this.router.navigateByUrl(entry.link);
  }
}
